import type { Node as BroccoliNode } from 'broccoli-node-api';
import type { Stage, Package } from '@embroider/core';
import { PackageCache, WaitForTrees, RewrittenPackageCache, locateEmbroiderWorkingDir } from '@embroider/core';
import type Options from './options';
import { optionsWithDefaults } from './options';
import { Memoize } from 'typescript-memoize';
import { sync as pkgUpSync } from 'pkg-up';
import { join, dirname, isAbsolute, sep } from 'path';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import ContentForConfig from './content-for-config';
import { V1Config } from './v1-config';
import type { AddonMeta, EmberAppInstance, OutputFileToInputFileMap, PackageInfo } from '@embroider/core';
import { writeJSONSync, ensureDirSync, copySync, pathExistsSync, existsSync, writeFileSync } from 'fs-extra';
import AddToTree from './add-to-tree';
import DummyPackage from './dummy-package';
import type { TransformOptions } from '@babel/core';
import { isEmbroiderMacrosPlugin, MacrosConfig } from '@embroider/macros/src/node';
import resolvePackagePath from 'resolve-package-path';
import Concat from 'broccoli-concat';
import mapKeys from 'lodash/mapKeys';
import { isEmberAutoImportDynamic, isInlinePrecompilePlugin } from './detect-babel-plugins';
import loadAstPlugins from './prepare-htmlbars-ast-plugins';
import { readFileSync } from 'fs';
import semver from 'semver';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import { CompatAppBuilder } from './compat-app-builder';
import walkSync from 'walk-sync';

interface Group {
  outputFiles: OutputFileToInputFileMap;
  implicitKey: '_implicitStyles' | '_implicitScripts';
  vendorOutputPath: 'string';
}

// This runs at broccoli-pipeline-construction time, whereas the
// CompatAppBuilder instance only becomes available during tree-building time.
export default class CompatApp {
  private annotation = '@embroider/compat/app';
  private active: CompatAppBuilder | undefined;
  readonly options: Required<Options>;

  private _publicAssets: { [filePath: string]: string } = Object.create(null);
  private _implicitScripts: string[] = [];
  private _implicitStyles: string[] = [];

  private get isDummy(): boolean {
    return this.legacyEmberAppInstance.project.pkg.keywords?.includes('ember-addon') ?? false;
  }

  get name(): string {
    if (this.isDummy) {
      // here we accept the ember-cli behavior
      return this.legacyEmberAppInstance.name;
    } else {
      // always the name from package.json. Not the one that apps may have weirdly
      // customized.
      return this.legacyEmberAppInstance.project.pkg.name;
    }
  }

  get env(): string {
    return this.legacyEmberAppInstance.env;
  }

  @Memoize()
  get root(): string {
    if (this.isDummy) {
      // this is the Known Hack for finding the true root of the dummy app.
      return join(this.legacyEmberAppInstance.project.configPath(), '..', '..');
    } else {
      return dirname(pkgUpSync({ cwd: this.legacyEmberAppInstance.project.root })!);
    }
  }

  @Memoize()
  private get emberCLILocation() {
    const emberCLIPackage = resolvePackagePath('ember-cli', this.root);

    if (emberCLIPackage === null) {
      throw new Error(`Embroider: cannot resolve ember-cli's package.json`);
    }

    return dirname(emberCLIPackage);
  }

  @Memoize()
  get hasCompiledStyles() {
    return semver.gte(JSON.parse(readFileSync(`${this.emberCLILocation}/package.json`, 'utf8')).version, '3.18.0');
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

  @Memoize()
  get addonTreeCache(): Map<string, BroccoliNode> {
    return new Map();
  }

  @Memoize()
  get preprocessRegistry() {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  get shouldBuildTests(): boolean {
    return this.legacyEmberAppInstance.tests || false;
  }

  configPath(): string {
    return this.legacyEmberAppInstance.project.configPath();
  }

  private get configTree() {
    return new this.configLoader(dirname(this.configPath()), {
      env: this.legacyEmberAppInstance.env,
      tests: this.legacyEmberAppInstance.tests || false,
      project: this.legacyEmberAppInstance.project,
    });
  }

  @Memoize()
  private get config(): V1Config {
    return new V1Config(this.configTree, this.legacyEmberAppInstance.env);
  }

  @Memoize()
  get testConfig(): V1Config | undefined {
    if (this.shouldBuildTests) {
      return new V1Config(this.configTree, 'test');
    }
  }

  @Memoize()
  private get contentFor(): ContentForConfig {
    const configPaths = [
      { file: '/index.html', path: join('environments', `${this.legacyEmberAppInstance.env}.json`) },
    ];
    if (this.shouldBuildTests) configPaths.push({ file: '/tests/index.html', path: join('environments', `test.json`) });
    return new ContentForConfig(this.configTree, {
      availableContentForTypes: this.options.availableContentForTypes,
      configPaths,
      pattern: this.filteredPatternsByContentFor.contentFor,
    });
  }

  get autoRun(): boolean {
    return this.legacyEmberAppInstance.options.autoRun;
  }

  private get storeConfigInMeta(): boolean {
    return this.legacyEmberAppInstance.options.storeConfigInMeta;
  }

  @Memoize()
  private get configReplacePatterns() {
    return this.appUtils.configReplacePatterns({
      addons: this.legacyEmberAppInstance.project.addons,
      autoRun: this.autoRun,
      storeConfigInMeta: this.storeConfigInMeta,
    });
  }

  private get filteredPatternsByContentFor() {
    const filter = '/{{content-for [\'"](.+?)["\']}}/g';
    return {
      contentFor: this.configReplacePatterns.find((pattern: any) => filter.includes(pattern.match.toString())),
      others: this.configReplacePatterns.filter((pattern: any) => !filter.includes(pattern.match.toString())),
    };
  }

  private get htmlTree() {
    if (this.legacyEmberAppInstance.tests) {
      return mergeTrees([this.indexTree, this.testIndexTree]);
    } else {
      return this.indexTree;
    }
  }

  private get indexTree() {
    let indexFilePath = this.legacyEmberAppInstance.options.outputPaths.app.html;
    let index = buildFunnel(this.legacyEmberAppInstance.trees.app, {
      allowEmpty: true,
      include: [`index.html`],
      getDestinationPath: () => indexFilePath,
      annotation: 'app/index.html',
    });
    return new this.configReplace(index, this.configTree, {
      configPath: join('environments', `${this.legacyEmberAppInstance.env}.json`),
      files: [indexFilePath],
      patterns: this.filteredPatternsByContentFor.others,
      annotation: 'ConfigReplace/indexTree',
    });
  }

  private get testIndexTree() {
    let index = buildFunnel(this.legacyEmberAppInstance.trees.tests, {
      allowEmpty: true,
      include: [`index.html`],
      destDir: 'tests',
      annotation: 'tests/index.html',
    });
    return new this.configReplace(index, this.configTree, {
      configPath: join('environments', `test.json`),
      files: ['tests/index.html'],
      patterns: this.filteredPatternsByContentFor.others,
      annotation: 'ConfigReplace/testIndexTree',
    });
  }

  @Memoize()
  babelConfig(): TransformOptions {
    let plugins: any[] = [];
    let presets: any[] = [];

    // this finds any custom babel configuration that's on the app (either
    // because the app author explicitly added some, or because addons have
    // pushed plugins into it).
    let appBabel = this.legacyEmberAppInstance.options.babel;
    if (appBabel) {
      if (appBabel.plugins) {
        plugins = appBabel.plugins.concat(plugins);
      }
      if (appBabel.presets) {
        if (this.legacyEmberAppInstance.options.useCustomBabelPresets) {
          throw new Error(`
            The following Babel presets have been found on the app custom Babel configuration:

            ${presets}

            Either these presets have been added explicitly to the app (e.g. through ember-cli-babel options in ember-cli-build.js), either classic addons have pushed these presets into the app.
            With Embroider, you have full control over the Babel config via babel.config.cjs, and babel.config.cjs should be the only source of truth regarding Babel configuration; so classic addons no longer have the ability to push Babel presets.
            
            1. Add the presets you want to use to the babel.config.cjs.
            2. Once babel.config.cjs has the presets you need, remove the present error by setting "useCustomBabelPresets" to false in the build options.
          `);
        }
      }
    }

    plugins = plugins.filter(p => {
      // even if the app was using @embroider/macros, we drop it from the config
      // here in favor of our globally-configured one.
      return (
        !isEmbroiderMacrosPlugin(p) &&
        // similarly, if the app was already using an inline template compiler
        // babel plugin, we remove it here because we have our own
        // always-installed version of that (v2 addons are allowed to assume it
        // will be present in the final app build, the app doesn't get to turn
        // that off or configure it.)
        !isInlinePrecompilePlugin(p) &&
        !isEmberAutoImportDynamic(p)
      );
    });

    const config: TransformOptions = {
      babelrc: false,
      plugins,
      presets,
      // this is here because broccoli-middleware can't render a codeFrame full
      // of terminal codes. It would be nice to add something like
      // https://github.com/mmalecki/ansispan to broccoli-middleware so we can
      // leave color enabled.
      highlightCode: false,
    };

    return config;
  }

  @Memoize()
  babelMajorVersion(): 7 {
    let babelAddon = this.legacyEmberAppInstance.project.addons.find((a: any) => a.name === 'ember-cli-babel');
    if (babelAddon) {
      let babelAddonMajor = Number(babelAddon.pkg.version.split('.')[0]);
      let babelMajor: number | undefined = babelAddonMajor;
      if (babelAddonMajor >= 8) {
        // `ember-cli-babel` v8 breaks lockstep with Babel, because it now
        // defines `@babel/core` as a peer dependency, so we need to check the
        // project's version of `@babel/core`:
        let babelVersion = this.legacyEmberAppInstance.project.pkg.devDependencies?.['@babel/core'];
        if (babelVersion) {
          babelMajor = semver.coerce(babelVersion)?.major;
        } else {
          babelMajor = 7;
        }
      }
      if (babelMajor !== 7) {
        throw new Error('`@embroider/compat` only supports apps and addons that use Babel v7.');
      }
      return babelMajor;
    }
    // if we didn't have our own babel plugin at all, it's safe to parse our
    // code with 7.
    return 7;
  }

  @Memoize()
  private transformedNodeFiles(): Map<string, string> {
    // any app.imports from node_modules that need custom transforms will need
    // to get copied into our own synthesized vendor package. app.imports from
    // node_modules that *don't* need custom transforms can just stay where they
    // are.
    let transformed = new Map();
    for (let transformConfig of this.legacyEmberAppInstance._customTransformsMap.values()) {
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
      for (let { name, path } of this.legacyEmberAppInstance._nodeModules.values()) {
        if (match[1] === name) {
          return filename.replace(match[0], path + sep);
        }
      }
      throw new Error(`bug: expected ember-cli to already have a resolved path for asset ${filename}`);
    }
  }

  private combinedVendor(addonTrees: BroccoliNode[]): BroccoliNode {
    let trees = addonTrees.map(tree =>
      buildFunnel(tree, {
        allowEmpty: true,
        srcDir: 'vendor',
        destDir: 'vendor',
      })
    );
    if (this.vendorTree) {
      trees.push(
        buildFunnel(this.vendorTree, {
          destDir: 'vendor',
        })
      );
    }

    const tree = mergeTrees(trees, { overwrite: true });

    const outputGroups: Group[] = [
      // scripts
      {
        outputFiles: this.legacyEmberAppInstance._scriptOutputFiles,
        implicitKey: '_implicitScripts',
        vendorOutputPath: this.legacyEmberAppInstance.options.outputPaths.vendor.js,
      },
      // styles
      {
        outputFiles: this.legacyEmberAppInstance._styleOutputFiles,
        implicitKey: '_implicitStyles',
        vendorOutputPath: this.legacyEmberAppInstance.options.outputPaths.vendor.css,
      },
    ];

    const concatentations = [];

    // support: app.import / outputFile / using
    for (let entry of outputGroups) {
      const { outputFiles, implicitKey, vendorOutputPath } = entry;
      for (let importPath of Object.keys(outputFiles)) {
        const headerFiles = outputFiles[importPath];

        if (importPath === vendorOutputPath) {
          // these are the default ember-cli output files vendor.js or
          // vendor.css. Let embroider handle these.
          this[implicitKey] = headerFiles;
        } else if (headerFiles.length === 0) {
          // something went really wrong, open an issue
          throw new Error('Embroider: EWUT');
        } else if (headerFiles.length === 1) {
          // app.import(x, { outputFile: y }); where only one app.imports had this outputFile
          //
          // No concat needed. Simply serialize the remapping in the addon's
          // manifest, this ensures it is included in the final output with no extra work.
          this._publicAssets[headerFiles[0]] = importPath;
        } else {
          // app.import(x, { outputFile: y }); where multiple app.imports share one outputFile
          // Concat needed. Perform concat, and include the outputFile in the
          // addon's manifest. This ensures it is included in the final output
          this._publicAssets[importPath] = importPath;

          concatentations.push(
            new Concat(tree, {
              headerFiles,
              outputFile: importPath,
              annotation: `Package ${importPath}`,
              separator: '\n;',
              sourceMapConfig: this.legacyEmberAppInstance.options['sourcemaps'],
            })
          );
        }
      }
    }

    this.addOtherAssets();
    return mergeTrees([tree, ...concatentations], { overwrite: true });
  }

  private addOtherAssets() {
    for (let asset of this.legacyEmberAppInstance.otherAssetPaths) {
      this._publicAssets[`${asset.src}/${asset.file}`] = `${asset.dest}/${asset.file}`;
    }
  }

  private addNodeAssets(inputTree: BroccoliNode): BroccoliNode {
    let transformedNodeFiles = this.transformedNodeFiles();

    return new AddToTree(inputTree, outputPath => {
      for (let [localDestPath, sourcePath] of transformedNodeFiles) {
        let destPath = join(outputPath, localDestPath);
        ensureDirSync(dirname(destPath));
        copySync(sourcePath, destPath);
      }

      if (this.shouldBuildTests) {
        writeFileSync(
          join(outputPath, 'testem.js'),
          `/*
 * This is dummy file that exists for the sole purpose
 * of allowing tests to run directly in the browser as
 * well as by Testem.
 *
 * Testem is configured to run tests directly against
 * the test build of index.html, which requires a
 * snippet to load the testem.js file:
 *   <script src="/testem.js"></script>
 * This has to go before the qunit framework and app
 * tests are loaded.
 *
 * Testem internally supplies this file. However, if you
 * run the tests directly in the browser (localhost:8000/tests),
 * this file does not exist.
 *
 * Hence the purpose of this fake file. This file is served
 * directly from the express server to satisify the script load.
*/`
        );
        this._publicAssets['/testem.js'] = './testem.js';
      }

      let remapAsset = this.remapAsset.bind(this);

      let addonMeta: AddonMeta = {
        type: 'addon',
        version: 2,
        'implicit-scripts': this._implicitScripts.map(remapAsset),
        'implicit-styles': this._implicitStyles.map(remapAsset),
        'implicit-test-scripts': this.legacyEmberAppInstance.legacyTestFilesToAppend.map(remapAsset),
        'implicit-test-styles': this.legacyEmberAppInstance.vendorTestStaticStyles.map(remapAsset),
        'public-assets': mapKeys(this._publicAssets, (_, key) => remapAsset(key)),
      };
      let meta: PackageInfo = {
        name: '@embroider/synthesized-vendor',
        version: '0.0.0',
        keywords: ['ember-addon'],
        'ember-addon': addonMeta,
      };
      writeJSONSync(join(outputPath, 'package.json'), meta, { spaces: 2 });
    });
  }

  synthesizeVendorPackage(addonTrees: BroccoliNode[]): BroccoliNode {
    return this.applyCustomTransforms(this.addNodeAssets(this.combinedVendor(addonTrees)));
  }

  private combinedStyles(addonTrees: BroccoliNode[]): BroccoliNode {
    let trees: BroccoliNode[] = addonTrees.map(tree =>
      buildFunnel(tree, {
        allowEmpty: true,
        srcDir: '_app_styles_',
      })
    );
    let appStyles = this.legacyEmberAppInstance.trees.styles as BroccoliNode | undefined;
    if (appStyles) {
      // Workaround for https://github.com/ember-cli/ember-cli/issues/9020
      //
      // The default app styles tree is unwatched and relies on side effects
      // elsewhere in ember-cli's build pipeline to actually get rebuilds to
      // work. Here we need it to actually be watched properly if we want to
      // rely on it, particularly when using BROCCOLI_ENABLED_MEMOIZE.
      if ((appStyles as any)._watched === false && (appStyles as any)._directoryPath) {
        appStyles = new WatchedDir((appStyles as any)._directoryPath);
      }
      trees.push(appStyles);
    }
    return mergeTrees(trees, { overwrite: true, annotation: 'embroider-v1-app-combined-styles' });
  }

  synthesizeStylesPackage(addonTrees: BroccoliNode[]): BroccoliNode {
    let options = {
      // we're deliberately not allowing this to be customized. It's an
      // internal implementation detail, and respecting outputPaths here is
      // unnecessary complexity. The corresponding code that adjusts the HTML
      // <link> is in updateHTML in app.ts.
      outputPaths: { app: `/assets/${this.name}.css` },
      registry: this.legacyEmberAppInstance.registry,
      minifyCSS: this.legacyEmberAppInstance.options.minifyCSS.options,
    };

    let nestedInput = buildFunnel(this.combinedStyles(addonTrees), { destDir: 'app/styles' });
    let styles = this.preprocessors.preprocessCss(nestedInput, '/app/styles', '/assets', options);

    return new AddToTree(styles, outputPath => {
      let addonMeta: AddonMeta = {
        type: 'addon',
        version: 2,
        'public-assets': {},
      };
      let assetPath = join(outputPath, 'assets');
      if (pathExistsSync(assetPath)) {
        for (let file of walkSync(assetPath, { directories: false })) {
          addonMeta['public-assets']![`./assets/${file}`] = `/assets/${file}`;
        }
      }
      let meta: PackageInfo = {
        name: '@embroider/synthesized-styles',
        version: '0.0.0',
        keywords: ['ember-addon'],
        'ember-addon': addonMeta,
      };
      writeJSONSync(join(outputPath, 'package.json'), meta, { spaces: 2 });
    });
  }

  // this is taken nearly verbatim from ember-cli.
  private applyCustomTransforms(externalTree: BroccoliNode) {
    for (let customTransformEntry of this.legacyEmberAppInstance._customTransformsMap) {
      let transformName = customTransformEntry[0];
      let transformConfig = customTransformEntry[1];

      let transformTree = buildFunnel(externalTree, {
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

  private remapAsset(asset: string) {
    if (this.transformedNodeFiles().has(asset)) {
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
    if (asset.startsWith('.') || isAbsolute(asset)) {
      return asset;
    }
    return './' + asset;
  }

  private preprocessJS(tree: BroccoliNode): BroccoliNode {
    // we're saving all our babel compilation for the final stage packager
    this.legacyEmberAppInstance.registry.remove('js', 'ember-cli-babel');

    // auto-import is supported natively so we don't need it here
    this.legacyEmberAppInstance.registry.remove('js', 'ember-auto-import-analyzer');

    tree = buildFunnel(tree, { destDir: this.name });

    tree = this.preprocessors.preprocessJs(tree, `/`, '/', {
      annotation: 'v1-app-preprocess-js',
      registry: this.legacyEmberAppInstance.registry,
    });

    tree = buildFunnel(tree, { srcDir: this.name });

    return tree;
  }

  get htmlbarsPlugins(): Transform[] {
    let plugins = loadAstPlugins(this.legacyEmberAppInstance.registry);
    // even if the app was using @embroider/macros, we drop it from the config
    // here in favor of our globally-configured one.
    plugins = plugins.filter((p: any) => !isEmbroiderMacrosPlugin(p));
    return plugins;
  }

  // our own appTree. Not to be confused with the one that combines the app js
  // from all addons too.
  private get appTree(): BroccoliNode {
    return this.preprocessJS(
      buildFunnel(this.legacyEmberAppInstance.trees.app, {
        exclude: ['styles/**', '*.html'],
      })
    );
  }

  private get testsTree(): BroccoliNode | undefined {
    if (this.shouldBuildTests && this.legacyEmberAppInstance.trees.tests) {
      return this.preprocessJS(
        buildFunnel(this.legacyEmberAppInstance.trees.tests, {
          destDir: 'tests',
        })
      );
    }
  }

  private get lintTree(): BroccoliNode | undefined {
    if (this.shouldBuildTests) {
      return this.legacyEmberAppInstance.getLintTests();
    }
  }

  private get vendorTree(): BroccoliNode | undefined {
    return this.ensureTree(this.legacyEmberAppInstance.trees.vendor);
  }

  private ensureTree(maybeTree: string | BroccoliNode | undefined): BroccoliNode | undefined {
    if (typeof maybeTree === 'string') {
      // this is deliberately mimicking how ember-cli does it. We don't use
      // `this.root` on purpose, because that can differ from what ember-cli
      // considers the project.root. And we don't use path.resolve even though
      // that seems possibly more correct, because ember-cli always assumes the
      // input is relative.
      let resolvedPath = join(this.legacyEmberAppInstance.project.root, maybeTree);
      if (existsSync(resolvedPath)) {
        return new WatchedDir(maybeTree);
      } else {
        return undefined;
      }
    }
    return maybeTree;
  }

  @Memoize()
  private get preprocessors(): Preprocessors {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  private get publicTree(): BroccoliNode | undefined {
    return this.ensureTree(this.legacyEmberAppInstance.trees.public);
  }

  private processAppJS(): { appJS: BroccoliNode } {
    let appTree = this.appTree;
    let testsTree = this.testsTree;
    let lintTree = this.lintTree;

    let trees: BroccoliNode[] = [];
    trees.push(appTree);

    if (testsTree) {
      trees.push(testsTree);
    }
    if (lintTree) {
      trees.push(lintTree);
    }
    return {
      appJS: mergeTrees(trees, { overwrite: true }),
    };
  }

  readonly macrosConfig: MacrosConfig;

  constructor(readonly legacyEmberAppInstance: EmberAppInstance, _options?: Options) {
    this.options = optionsWithDefaults(_options);

    this.macrosConfig = MacrosConfig.for(legacyEmberAppInstance, this.root);
    if (this.env !== 'production') {
      this.macrosConfig.enablePackageDevelopment(this.root);
      this.macrosConfig.enableRuntimeMode();
      if (this.isDummy) {
        // dummy apps automatically put their owning addon under development too
        this.macrosConfig.enablePackageDevelopment(
          dirname(pkgUpSync({ cwd: this.legacyEmberAppInstance.project.root })!)
        );
      }
    }

    // this uses globalConfig because it's a way for packages to ask "is
    // Embroider doing this build?". So it's necessarily global, not scoped to
    // any subgraph of dependencies.
    this.macrosConfig.setGlobalConfig(__filename, `@embroider/core`, {
      // this is hard-coded to true because it literally means "embroider is
      // building this Ember app". You can see non-true when using the Embroider
      // macros in a classic build.
      active: true,
    });
  }

  private inTrees(prevStageTree: BroccoliNode) {
    let publicTree = this.publicTree;
    let configTree = this.config;
    let contentForTree = this.contentFor;

    if (this.options.extraPublicTrees.length > 0) {
      publicTree = mergeTrees([publicTree, ...this.options.extraPublicTrees].filter(Boolean) as BroccoliNode[]);
    }

    return {
      appJS: this.processAppJS().appJS,
      htmlTree: this.htmlTree,
      publicTree,
      configTree,
      contentForTree,
      prevStageTree,
    };
  }

  @Memoize()
  appPackage(): Package {
    // this is deliberately not RewrittenPackageCache, because it's supposed to
    // be the original copy of the app with all the original dependencies.
    let packageCache = PackageCache.shared('embroider', this.root);
    if (this.isDummy) {
      return new DummyPackage(
        this.root,
        this.legacyEmberAppInstance.project.root,
        packageCache as unknown as PackageCache // TODO: cast won't be needed when refactor is complete
      );
    } else {
      return packageCache.get(this.root);
    }
  }

  private async instantiate(
    root: string,
    packageCache: RewrittenPackageCache,
    configTree: V1Config,
    contentForTree: ContentForConfig
  ) {
    let origAppPkg = this.appPackage();
    let movedAppPkg = packageCache.withRewrittenDeps(origAppPkg);
    let workingDir = locateEmbroiderWorkingDir(this.root);
    return new CompatAppBuilder(
      root,
      origAppPkg,
      movedAppPkg,
      this.options,
      this,
      configTree,
      contentForTree,
      packageCache.get(join(workingDir, 'rewritten-packages', '@embroider', 'synthesized-vendor')),
      packageCache.get(join(workingDir, 'rewritten-packages', '@embroider', 'synthesized-styles'))
    );
  }

  asStage(prevStage: Stage): Stage {
    let resolve: (result: { outputPath: string }) => void;
    let promise: Promise<{ outputPath: string }> = new Promise(r => (resolve = r));

    let tree = () => {
      let inTrees = this.inTrees(prevStage.tree);
      return new WaitForTrees(inTrees, this.annotation, async treePaths => {
        if (!this.active) {
          let { outputPath } = await prevStage.ready();
          let packageCache = RewrittenPackageCache.shared('embroider', this.root);
          this.active = await this.instantiate(outputPath, packageCache, inTrees.configTree, inTrees.contentForTree);
          resolve({ outputPath });
        }
        await this.active.build(treePaths);
      });
    };

    return {
      get inputPath() {
        return prevStage.inputPath;
      },
      ready: async () => {
        return await promise;
      },
      get tree() {
        return tree();
      },
    };
  }
}

interface Preprocessors {
  preprocessJs(tree: BroccoliNode, a: string, b: string, options: object): BroccoliNode;
  preprocessCss(tree: BroccoliNode, a: string, b: string, options: object): BroccoliNode;
}
