import { Memoize } from 'typescript-memoize';
import { sync as pkgUpSync } from 'pkg-up';
import { join, dirname } from 'path';
import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import V1Package from './v1-package';
import { Tree } from 'broccoli-plugin';
import DependencyAnalyzer from './dependency-analyzer';
import ImportParser from './import-parser';
import get from 'lodash/get';
import { V1Config, WriteV1Config } from './v1-config';
import { PackageCache, TemplateCompiler, TemplateCompilerPlugins, AddonMeta } from '@embroider/core';
import { writeJSONSync, ensureDirSync, copySync, readdirSync } from 'fs-extra';
import AddToTree from './add-to-tree';
import DummyPackage from './dummy-package';
import { TransformOptions } from '@babel/core';
import { isEmbroiderMacrosPlugin } from '@embroider/macros';
import resolvePackagePath from 'resolve-package-path';

// This controls and types the interface between our new world and the classic
// v1 app instance.

export default class V1App implements V1Package {
  static create(app: any, packageCache: PackageCache): V1App {
    if (app.project.pkg.keywords && app.project.pkg.keywords.includes('ember-addon')) {
      // we are a dummy app, which is unfortunately weird and special
      return new V1DummyApp(app, packageCache);
    } else {
      return new V1App(app, packageCache);
    }
  }

  protected constructor(protected app: any, private packageCache: PackageCache) {}

  // always the name from package.json. Not the one that apps may have weirdly
  // customized.
  get name(): string {
    return this.app.project.pkg.name;
  }

  get env(): string {
    return this.app.env;
  }

  @Memoize()
  get root(): string {
    return dirname(pkgUpSync(this.app.project.root)!);
  }

  @Memoize()
  get isModuleUnification() {
    let experiments = this.requireFromEmberCLI('./lib/experiments');
    return experiments.MODULE_UNIFICATION && !!this.app.trees.src;
  }

  @Memoize()
  private get emberCLILocation() {
    return dirname(resolvePackagePath('ember-cli', this.root));
  }

  private requireFromEmberCLI(specifier: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(resolve.sync(specifier, { basedir: this.emberCLILocation }));
  }

  private get configReplace() {
    return this.requireFromEmberCLI('broccoli-config-replace');
  }

  private get configLoader() {
    return this.requireFromEmberCLI('broccoli-config-loader');
  }

  private get appUtils() {
    return this.requireFromEmberCLI('./lib/utilities/ember-app-utils');
  }

  get shouldBuildTests(): boolean {
    return this.app.tests || false;
  }

  private get configTree() {
    return new this.configLoader(dirname(this.app.project.configPath()), {
      env: this.app.env,
      tests: this.app.tests || false,
      project: this.app.project,
    });
  }

  @Memoize()
  get config(): V1Config {
    return new V1Config(this.configTree, this.app.env);
  }

  get autoRun(): boolean {
    return this.app.options.autoRun;
  }

  private get storeConfigInMeta(): boolean {
    return this.app.options.storeConfigInMeta;
  }

  get htmlTree() {
    if (this.app.tests) {
      return mergeTrees([this.indexTree, this.app.testIndex()]);
    }
    {
      return this.indexTree;
    }
  }

  get indexTree() {
    let indexFilePath = this.app.options.outputPaths.app.html;

    let index: Tree = new Funnel(this.app.trees.app, {
      allowEmpty: true,
      include: [`index.html`],
      getDestinationPath: () => indexFilePath,
      annotation: 'app/index.html',
    });

    if (this.isModuleUnification) {
      let srcIndex = new Funnel(new WatchedDir(join(this.root, 'src')), {
        files: ['ui/index.html'],
        getDestinationPath: () => indexFilePath,
        annotation: 'src/ui/index.html',
      });

      index = mergeTrees([index, srcIndex], {
        overwrite: true,
        annotation: 'merge classic and MU index.html',
      });
    }

    let patterns = this.appUtils.configReplacePatterns({
      addons: this.app.project.addons,
      autoRun: this.autoRun,
      storeConfigInMeta: this.storeConfigInMeta,
      isModuleUnification: this.isModuleUnification,
    });

    return new this.configReplace(index, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: [indexFilePath],
      patterns,
    });
  }

  babelConfig(): TransformOptions {
    let plugins = get(this.app.options, 'babel.plugins') as any[];
    if (!plugins) {
      plugins = [];
    } else {
      plugins = plugins.filter(p => {
        // even if the app was using @embroider/macros, we drop it from the config
        // here in favor of our globally-configured one.
        return (
          !isEmbroiderMacrosPlugin(p) &&
          // similarly, if the app was already using
          // ember-cli-htmlbars-inline-precompile, we remove it here because we
          // have our own always-installed version of that (v2 addons are
          // allowed to assume it will be present in the final app build, the
          // app doesn't get to turn that off or configure it.).
          !TemplateCompiler.isInlinePrecompilePlugin(p)
        );
      });
    }

    // this is reproducing what ember-cli-babel does. It would be nicer to just
    // call it, but it require()s all the plugins up front, so not serializable.
    // In its case, it's mostly doing it to set basedir so that broccoli caching
    // will be happy, but that's irrelevant to us here.
    plugins.push(this.debugMacrosPlugin());
    let babelInstance = (this.app.project.addons as any[]).find(a => a.name === 'ember-cli-babel');
    if (babelInstance._emberVersionRequiresModulesAPIPolyfill()) {
      let ModulesAPIPolyfill = require.resolve('babel-plugin-ember-modules-api-polyfill');
      let blacklist = babelInstance._getEmberModulesAPIBlacklist();
      plugins.push([ModulesAPIPolyfill, { blacklist }]);
    }

    let config: TransformOptions = {
      babelrc: false,
      plugins,
      presets: [
        [
          require.resolve('babel-preset-env'),
          {
            targets: babelInstance._getTargets(),
            modules: false,
          },
        ],
      ],
      // this is here because broccoli-middleware can't render a codeFrame full
      // of terminal codes. It would be nice to add something like
      // https://github.com/mmalecki/ansispan to broccoli-middleware so we can
      // leave color enabled.
      highlightCode: false,
    };
    return config;
  }

  private debugMacrosPlugin() {
    let DebugMacros = require.resolve('babel-plugin-debug-macros');
    let isProduction = process.env.EMBER_ENV === 'production';
    let options = {
      envFlags: {
        source: '@glimmer/env',
        flags: { DEBUG: !isProduction, CI: !!process.env.CI },
      },

      externalizeHelpers: {
        global: 'Ember',
      },

      debugTools: {
        source: '@ember/debug',
        assertPredicateIndex: 1,
      },
    };
    return [DebugMacros, options];
  }

  @Memoize()
  private transformedNodeFiles(): Map<string, string> {
    // any app.imports from node_modules that need custom transforms will need
    // to get copied into our own synthesized vendor package. app.imports from
    // node_modules that *don't* need custom transforms can just stay where they
    // are.
    let transformed = new Map();
    for (let transformConfig of this.app._customTransformsMap.values()) {
      for (let filename of transformConfig.files as string[]) {
        let preresolved = this.preresolvedNodeFile(filename);
        if (preresolved) {
          transformed.set(filename, preresolved);
        }
      }
    }
    return transformed;
  }

  private preresolvedNodeFile(filename: string) {
    // this regex is an exact copy of how ember-cli does this, so we align.
    let match = filename.match(/^node_modules\/((@[^/]+\/)?[^/]+)\//);
    if (match) {
      // ember-cli has already done its own resolution of
      // `app.import('node_modules/something/...')`, so we go find its answer.
      for (let { name, path } of this.app._nodeModules.values()) {
        if (match[1] === name) {
          return filename.replace(match[0], path + '/');
        }
      }
      throw new Error(`bug: expected ember-cli to already have a resolved path for asset ${filename}`);
    }
  }

  private combinedVendor(addonTrees: Tree[]): Tree {
    let trees = addonTrees.map(
      tree =>
        new Funnel(tree, {
          allowEmpty: true,
          srcDir: 'vendor',
          destDir: 'vendor',
        })
    );
    if (this.vendorTree) {
      trees.push(
        new Funnel(this.vendorTree, {
          destDir: 'vendor',
        })
      );
    }
    return mergeTrees(trees, { overwrite: true });
  }

  private addNodeAssets(inputTree: Tree): Tree {
    let transformedNodeFiles = this.transformedNodeFiles();
    return new AddToTree(inputTree, outputPath => {
      for (let [localDestPath, sourcePath] of transformedNodeFiles) {
        let destPath = join(outputPath, localDestPath);
        ensureDirSync(dirname(destPath));
        copySync(sourcePath, destPath);
      }

      let addonMeta: AddonMeta = {
        version: 2,
        'implicit-scripts': this.remapImplicitAssets(
          this.app._scriptOutputFiles[this.app.options.outputPaths.vendor.js]
        ),
        'implicit-styles': this.remapImplicitAssets(
          this.app._styleOutputFiles[this.app.options.outputPaths.vendor.css]
        ),
        'implicit-test-scripts': this.remapImplicitAssets(this.app.legacyTestFilesToAppend),
        'implicit-test-styles': this.remapImplicitAssets(this.app.vendorTestStaticStyles),
      };
      let meta = {
        name: '@embroider/synthesized-vendor',
        version: '0.0.0',
        keywords: 'ember-addon',
        'ember-addon': addonMeta,
      };
      writeJSONSync(join(outputPath, 'package.json'), meta, { spaces: 2 });
    });
  }

  synthesizeVendorPackage(addonTrees: Tree[]): Tree {
    return this.applyCustomTransforms(this.addNodeAssets(this.combinedVendor(addonTrees)));
  }

  private combinedStyles(addonTrees: Tree[]): Tree {
    let trees = addonTrees.map(
      tree =>
        new Funnel(tree, {
          allowEmpty: true,
          srcDir: '_app_styles_',
        })
    );
    if (this.app.trees.styles) {
      trees.push(this.app.trees.styles);
    }
    return mergeTrees(trees, { overwrite: true });
  }

  synthesizeStylesPackage(addonTrees: Tree[]): Tree {
    let options = {
      // we're deliberately not allowing this to be customized. It's an
      // internal implementation detail, and respecting outputPaths here is
      // unnecessary complexity. The corresponding code that adjusts the HTML
      // <link> is in updateHTML in app.ts.
      outputPaths: { app: `/assets/${this.name}.css` },
      registry: this.app.registry,
      minifyCSS: this.app.options.minifyCSS.options,
    };

    let styles = this.preprocessors.preprocessCss(this.combinedStyles(addonTrees), '.', '/assets', options);

    return new AddToTree(styles, outputPath => {
      let addonMeta: AddonMeta = {
        version: 2,
        'public-assets': {},
      };
      for (let file of readdirSync(join(outputPath, 'assets'))) {
        addonMeta['public-assets']![`./assets/${file}`] = `/assets/${file}`;
      }
      let meta = {
        name: '@embroider/synthesized-styles',
        version: '0.0.0',
        keywords: 'ember-addon',
        'ember-addon': addonMeta,
      };
      writeJSONSync(join(outputPath, 'package.json'), meta, { spaces: 2 });
    });
  }

  // this is taken nearly verbatim from ember-cli.
  private applyCustomTransforms(externalTree: Tree) {
    for (let customTransformEntry of this.app._customTransformsMap) {
      let transformName = customTransformEntry[0];
      let transformConfig = customTransformEntry[1];

      let transformTree = new Funnel(externalTree, {
        files: transformConfig.files,
        annotation: `Funnel (custom transform: ${transformName})`,
      });

      externalTree = mergeTrees([externalTree, transformConfig.callback(transformTree, transformConfig.options)], {
        annotation: `TreeMerger (custom transform: ${transformName})`,
        overwrite: true,
      });
    }
    return externalTree;
  }

  private remapImplicitAssets(assets: string[]) {
    let transformedNodeFiles = this.transformedNodeFiles();
    return assets.map(asset => {
      if (transformedNodeFiles.has(asset)) {
        // transformed node assets become local paths, because we have copied
        // those ones into our synthesized vendor package.
        return './' + asset;
      }
      let preresolved = this.preresolvedNodeFile(asset);
      if (preresolved) {
        // non-transformed node assets point directly at their pre-resolved
        // original files (this is an absolute path).
        return preresolved;
      }
      // non node assets are local paths. They need an explicit `/` or `.` at
      // the start.
      if (asset.startsWith('/') || asset.startsWith('.')) {
        return asset;
      }
      return './' + asset;
    });
  }

  private preprocessJS(tree: Tree): Tree {
    // we're saving all our babel compilation for the final stage packager
    this.app.registry.remove('js', 'ember-cli-babel');

    // auto-import is supported natively so we don't need it here
    this.app.registry.remove('js', 'ember-auto-import-analyzer');

    return this.preprocessors.preprocessJs(tree, `/`, '/', {
      annotation: 'v1-app-preprocess-js',
      registry: this.app.registry,
    });
  }

  get htmlbarsPlugins(): TemplateCompilerPlugins {
    let addon = this.app.project.addons.find((a: any) => a.name === 'ember-cli-htmlbars');
    let options = addon.htmlbarsOptions();
    if (options.plugins.ast) {
      // even if the app was using @embroider/macros, we drop it from the config
      // here in favor of our globally-configured one.
      options.plugins.ast = options.plugins.ast.filter((p: any) => !isEmbroiderMacrosPlugin(p));
    }
    return options.plugins;
  }

  // our own appTree. Not to be confused with the one that combines the app js
  // from all addons too.
  private get appTree(): Tree {
    return this.preprocessJS(
      new Funnel(this.app.trees.app, {
        exclude: ['styles/**', '*.html'],
      })
    );
  }

  private get testsTree(): Tree | undefined {
    if (this.shouldBuildTests && this.app.trees.tests) {
      return this.preprocessJS(
        new Funnel(this.app.trees.tests, {
          destDir: 'tests',
        })
      );
    }
  }

  private get lintTree(): Tree | undefined {
    if (this.shouldBuildTests) {
      return this.app.getLintTests();
    }
  }

  get vendorTree(): Tree {
    return this.app.trees.vendor;
  }

  @Memoize()
  private get preprocessors(): Preprocessors {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  get publicTree(): Tree {
    return this.app.trees.public;
  }

  processAppJS(): { appJS: Tree; analyzer: DependencyAnalyzer } {
    let appTree = this.appTree;
    let testsTree = this.testsTree;
    let lintTree = this.lintTree;
    let importParsers = [new ImportParser(appTree)];
    if (testsTree) {
      importParsers.push(new ImportParser(testsTree));
    }
    if (lintTree) {
      importParsers.push(new ImportParser(lintTree));
    }
    let analyzer = new DependencyAnalyzer(importParsers, this.packageCache.getApp(this.root));
    let config = new WriteV1Config(this.config, this.storeConfigInMeta, this.name);
    let trees: Tree[] = [];
    trees.push(appTree);
    trees.push(config);
    if (testsTree) {
      trees.push(testsTree);
    }
    if (lintTree) {
      trees.push(lintTree);
    }
    return {
      appJS: mergeTrees(trees, { overwrite: true }),
      analyzer,
    };
  }

  findAppScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.app.js);
  }

  findAppStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.app.css.app);
  }

  findVendorScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.vendor.js);
  }

  findVendorStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.vendor.css);
  }

  findTestSupportStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.testSupport.css);
  }

  findTestSupportScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.testSupport.js.testSupport);
  }

  findTestScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.tests.js);
  }
}

class V1DummyApp extends V1App {
  constructor(app: any, packageCache: PackageCache) {
    super(app, packageCache);
    let owningAddon = packageCache.getAddon(this.app.project.root);
    let dummyPackage = new DummyPackage(this.root, owningAddon, packageCache);
    packageCache.overridePackage(dummyPackage);
    packageCache.overrideResolution(this.app.project.pkg.name, dummyPackage, owningAddon);
  }

  get name(): string {
    // here we accept the ember-cli behavior
    return this.app.name;
  }

  get root(): string {
    // this is the Known Hack for finding the true root of the dummy app.
    return join(this.app.project.configPath(), '..', '..');
  }
}

interface Preprocessors {
  preprocessJs(tree: Tree, a: string, b: string, options: object): Tree;
  preprocessCss(tree: Tree, a: string, b: string, options: object): Tree;
}
