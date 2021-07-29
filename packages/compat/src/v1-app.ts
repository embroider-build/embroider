import { Memoize } from 'typescript-memoize';
import { sync as pkgUpSync } from 'pkg-up';
import { join, dirname, isAbsolute } from 'path';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { Node } from 'broccoli-node-api';
import { V1Config, WriteV1Config } from './v1-config';
import { WriteV1AppBoot, ReadV1AppBoot } from './v1-appboot';
import { PackageCache, TemplateCompiler, TemplateCompilerPlugins, AddonMeta, Package } from '@embroider/core';
import { writeJSONSync, ensureDirSync, copySync, readdirSync, pathExistsSync, existsSync } from 'fs-extra';
import AddToTree from './add-to-tree';
import DummyPackage, { OwningAddon } from './dummy-package';
import { TransformOptions } from '@babel/core';
import { isEmbroiderMacrosPlugin } from '@embroider/macros/src/node';
import resolvePackagePath from 'resolve-package-path';
import Concat from 'broccoli-concat';
import mapKeys from 'lodash/mapKeys';
import SynthesizeTemplateOnlyComponents from './synthesize-template-only-components';
import { isEmberAutoImportDynamic } from './detect-babel-plugins';

// This controls and types the interface between our new world and the classic
// v1 app instance.

type FilePath = string;
type OutputFileToInputFileMap = { [filePath: string]: FilePath[] };

interface EmberApp {
  env: string;
  name: string;
  _scriptOutputFiles: OutputFileToInputFileMap;
  _styleOutputFiles: OutputFileToInputFileMap;
  legacyTestFilesToAppend: FilePath[];
  vendorTestStaticStyles: FilePath[];
  _customTransformsMap: Map<string, any>;
  _nodeModules: Map<string, { name: string; path: FilePath }>;
  options: any;
  tests: boolean;
  trees: any;
  project: any;
  registry: any;
  testIndex(): Node;
  getLintTests(): Node;
  otherAssetPaths: any[];
}

interface Group {
  outputFiles: OutputFileToInputFileMap;
  implicitKey: '_implicitStyles' | '_implicitScripts';
  vendorOutputPath: 'string';
}

export default class V1App {
  // used to signal that this is a dummy app owned by a particular addon
  owningAddon: Package | undefined;

  static create(app: EmberApp, packageCache: PackageCache): V1App {
    if (app.project.pkg.keywords && app.project.pkg.keywords.includes('ember-addon')) {
      // we are a dummy app, which is unfortunately weird and special
      return new V1DummyApp(app, packageCache);
    } else {
      return new V1App(app, packageCache);
    }
  }

  private _publicAssets: { [filePath: string]: string } = Object.create(null);
  private _implicitScripts: string[] = [];
  private _implicitStyles: string[] = [];

  protected constructor(protected app: EmberApp, protected packageCache: PackageCache) {}

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
    return dirname(pkgUpSync({ cwd: this.app.project.root })!);
  }

  @Memoize()
  private get emberCLILocation() {
    const emberCLIPackage = resolvePackagePath('ember-cli', this.root);

    if (emberCLIPackage === null) {
      throw new Error(`Embroider: cannot resolve ember-cli's package.json`);
    }

    return dirname(emberCLIPackage);
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
  get addonTreeCache(): Map<string, Node> {
    return new Map();
  }

  @Memoize()
  get preprocessRegistry() {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  get shouldBuildTests(): boolean {
    return this.app.tests || false;
  }

  configPath(): string {
    return this.app.project.configPath();
  }

  private get configTree() {
    return new this.configLoader(dirname(this.configPath()), {
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

  @Memoize()
  get appBoot(): ReadV1AppBoot {
    let env = this.app.env;
    let appBootContentTree = new WriteV1AppBoot();

    let patterns = this.configReplacePatterns;

    appBootContentTree = new this.configReplace(appBootContentTree, this.configTree, {
      configPath: join('environments', `${env}.json`),
      files: ['config/app-boot.js'],
      patterns,
    });

    return new ReadV1AppBoot(appBootContentTree);
  }

  private get storeConfigInMeta(): boolean {
    return this.app.options.storeConfigInMeta;
  }

  @Memoize()
  private get configReplacePatterns() {
    return this.appUtils.configReplacePatterns({
      addons: this.app.project.addons,
      autoRun: this.autoRun,
      storeConfigInMeta: this.storeConfigInMeta,
    });
  }

  get htmlTree() {
    if (this.app.tests) {
      return mergeTrees([this.indexTree, this.testIndexTree]);
    } else {
      return this.indexTree;
    }
  }

  private get indexTree() {
    let indexFilePath = this.app.options.outputPaths.app.html;
    let index = buildFunnel(this.app.trees.app, {
      allowEmpty: true,
      include: [`index.html`],
      getDestinationPath: () => indexFilePath,
      annotation: 'app/index.html',
    });
    return new this.configReplace(index, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: [indexFilePath],
      patterns: this.configReplacePatterns,
      annotation: 'ConfigReplace/indexTree',
    });
  }

  private get testIndexTree() {
    let index = buildFunnel(this.app.trees.tests, {
      allowEmpty: true,
      include: [`index.html`],
      destDir: 'tests',
      annotation: 'tests/index.html',
    });
    return new this.configReplace(index, this.configTree, {
      configPath: join('environments', `test.json`),
      files: ['tests/index.html'],
      patterns: this.configReplacePatterns,
      annotation: 'ConfigReplace/testIndexTree',
    });
  }

  @Memoize()
  babelConfig(): TransformOptions {
    // this finds all the built-in babel configuration that comes with ember-cli-babel
    const babelAddon = (this.app.project as any).findAddonByName('ember-cli-babel');
    const babelConfig = babelAddon.buildBabelOptions({
      'ember-cli-babel': {
        includeExternalHelpers: true,
        compileModules: false,
        disableDebugTooling: false,
        disablePresetEnv: false,
        disableEmberModulesAPIPolyfill: false,
        disableDecoratorTransforms: false,
      },
    });

    let plugins = babelConfig.plugins as any[];
    let presets = babelConfig.presets;

    // this finds any custom babel configuration that's on the app (either
    // because the app author explicitly added some, or because addons have
    // pushed plugins into it).
    let appBabel = this.app.options.babel;
    if (appBabel) {
      if (appBabel.plugins) {
        plugins = appBabel.plugins.concat(plugins);
      }
      if (appBabel.presets) {
        presets = appBabel.presets.concat(presets);
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
        !TemplateCompiler.isInlinePrecompilePlugin(p) &&
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
    let babelAddon = this.app.project.addons.find((a: any) => a.name === 'ember-cli-babel');
    if (babelAddon) {
      let major = Number(babelAddon.pkg.version.split('.')[0]);
      if (major !== 7) {
        throw new Error(`@embroider/compat only supports v1 addons that use babel 7`);
      }
      return major;
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

  private combinedVendor(addonTrees: Node[]): Node {
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
        outputFiles: this.app._scriptOutputFiles,
        implicitKey: '_implicitScripts',
        vendorOutputPath: this.app.options.outputPaths.vendor.js,
      },
      // styles
      {
        outputFiles: this.app._styleOutputFiles,
        implicitKey: '_implicitStyles',
        vendorOutputPath: this.app.options.outputPaths.vendor.css,
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
              sourceMapConfig: this.app.options['sourcemaps'],
            })
          );
        }
      }
    }

    this.addOtherAssets();
    return mergeTrees([tree, ...concatentations], { overwrite: true });
  }

  addOtherAssets() {
    for (let asset of this.app.otherAssetPaths) {
      this._publicAssets[`${asset.src}/${asset.file}`] = `${asset.dest}/${asset.file}`;
    }
  }

  private addNodeAssets(inputTree: Node): Node {
    let transformedNodeFiles = this.transformedNodeFiles();

    return new AddToTree(inputTree, outputPath => {
      for (let [localDestPath, sourcePath] of transformedNodeFiles) {
        let destPath = join(outputPath, localDestPath);
        ensureDirSync(dirname(destPath));
        copySync(sourcePath, destPath);
      }

      let remapAsset = this.remapAsset.bind(this);

      let addonMeta: AddonMeta = {
        type: 'addon',
        version: 2,
        'implicit-scripts': this._implicitScripts.map(remapAsset),
        'implicit-styles': this._implicitStyles.map(remapAsset),
        'implicit-test-scripts': this.app.legacyTestFilesToAppend.map(remapAsset),
        'implicit-test-styles': this.app.vendorTestStaticStyles.map(remapAsset),
        'public-assets': mapKeys(this._publicAssets, (_, key) => remapAsset(key)),
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

  synthesizeVendorPackage(addonTrees: Node[]): Node {
    return this.applyCustomTransforms(this.addNodeAssets(this.combinedVendor(addonTrees)));
  }

  private combinedStyles(addonTrees: Node[]): Node {
    let trees: Node[] = addonTrees.map(tree =>
      buildFunnel(tree, {
        allowEmpty: true,
        srcDir: '_app_styles_',
      })
    );
    let appStyles = this.app.trees.styles as Node | undefined;
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

  synthesizeStylesPackage(addonTrees: Node[]): Node {
    let options = {
      // we're deliberately not allowing this to be customized. It's an
      // internal implementation detail, and respecting outputPaths here is
      // unnecessary complexity. The corresponding code that adjusts the HTML
      // <link> is in updateHTML in app.ts.
      outputPaths: { app: `/assets/${this.name}.css` },
      registry: this.app.registry,
      minifyCSS: this.app.options.minifyCSS.options,
    };

    let nestedInput = buildFunnel(this.combinedStyles(addonTrees), { destDir: 'app/styles' });
    let styles = this.preprocessors.preprocessCss(nestedInput, 'app/styles', '/assets', options);

    return new AddToTree(styles, outputPath => {
      let addonMeta: AddonMeta = {
        type: 'addon',
        version: 2,
        'public-assets': {},
      };
      let assetPath = join(outputPath, 'assets');
      if (pathExistsSync(assetPath)) {
        for (let file of readdirSync(assetPath)) {
          addonMeta['public-assets']![`./assets/${file}`] = `/assets/${file}`;
        }
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
  private applyCustomTransforms(externalTree: Node) {
    for (let customTransformEntry of this.app._customTransformsMap) {
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

  private preprocessJS(tree: Node): Node {
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

      // The parallelization protocol in ember-cli-htmlbars doesn't actually
      // apply to the AST plugins, it applies to wrappers that
      // ember-cli-htmlbars keeps around the plugins. Those wrappers aren't
      // availble to us when we look at the template compiler configuration, so
      // we need to find them directly out of the registry here. And we need to
      // provide our own unwrapper shim to pull the real plugin out of the
      // wrapper after deserializing.
      for (let wrapper of this.app.registry.load('htmlbars-ast-plugin')) {
        if (wrapper.parallelBabel && wrapper.plugin && !wrapper.plugin.parallelBabel) {
          wrapper.plugin.parallelBabel = {
            requireFile: join(__dirname, 'htmlbars-unwrapper.js'),
            buildUsing: 'unwrapPlugin',
            params: wrapper.parallelBabel,
          };
        }
      }
    }
    return options.plugins;
  }

  // our own appTree. Not to be confused with the one that combines the app js
  // from all addons too.
  private get appTree(): Node {
    return this.preprocessJS(
      buildFunnel(this.app.trees.app, {
        exclude: ['styles/**', '*.html'],
      })
    );
  }

  private get testsTree(): Node | undefined {
    if (this.shouldBuildTests && this.app.trees.tests) {
      return this.preprocessJS(
        buildFunnel(this.app.trees.tests, {
          destDir: 'tests',
        })
      );
    }
  }

  private get lintTree(): Node | undefined {
    if (this.shouldBuildTests) {
      return this.app.getLintTests();
    }
  }

  get vendorTree(): Node | undefined {
    return this.ensureTree(this.app.trees.vendor);
  }

  private ensureTree(maybeTree: string | Node | undefined): Node | undefined {
    if (typeof maybeTree === 'string') {
      // this is deliberately mimicking how ember-cli does it. We don't use
      // `this.root` on purpose, because that can differ from what ember-cli
      // considers the project.root. And we don't use path.resolve even though
      // that seems possibly more correct, because ember-cli always assumes the
      // input is relative.
      let resolvedPath = join(this.app.project.root, maybeTree);
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

  get publicTree(): Node | undefined {
    return this.ensureTree(this.app.trees.public);
  }

  processAppJS(): { appJS: Node } {
    let appTree = this.appTree;
    let testsTree = this.testsTree;
    let lintTree = this.lintTree;
    let config = new WriteV1Config(this.config, this.storeConfigInMeta);
    let patterns = this.configReplacePatterns;
    let configReplaced = new this.configReplace(config, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: ['config/environment.js'],
      patterns,
    });

    let trees: Node[] = [];
    trees.push(appTree);
    trees.push(new SynthesizeTemplateOnlyComponents(appTree, ['components']));

    trees.push(configReplaced);
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

  private withoutRootURL(src: string) {
    let rootURL = this.config.readConfig().rootURL;
    if (src.startsWith(rootURL)) {
      src = '/' + src.slice(rootURL.length);
    } else if (src.startsWith('/' + rootURL)) {
      src = src.slice(rootURL.length);
    }
    return src;
  }

  findAppScript(scripts: HTMLScriptElement[], entrypoint: string): HTMLScriptElement {
    let appJS = scripts.find(script => this.withoutRootURL(script.src) === this.app.options.outputPaths.app.js);
    return throwIfMissing(
      appJS,
      this.app.options.outputPaths.app.js,
      scripts.map(s => s.src),
      entrypoint,
      'app javascript'
    );
  }

  findAppStyles(styles: HTMLLinkElement[], entrypoint: string): HTMLLinkElement {
    let style = styles.find(style => this.withoutRootURL(style.href) === this.app.options.outputPaths.app.css.app);
    return throwIfMissing(
      style,
      this.app.options.outputPaths.app.css.app,
      styles.map(s => s.href),
      entrypoint,
      'app css'
    );
  }

  findVendorScript(scripts: HTMLScriptElement[], entrypoint: string): HTMLScriptElement {
    let vendor = scripts.find(script => this.withoutRootURL(script.src) === this.app.options.outputPaths.vendor.js);
    return throwIfMissing(
      vendor,
      this.app.options.outputPaths.vendor.js,
      scripts.map(s => s.src),
      entrypoint,
      'vendor javascript'
    );
  }

  findVendorStyles(styles: HTMLLinkElement[], entrypoint: string): HTMLLinkElement {
    let vendorStyle = styles.find(style => this.withoutRootURL(style.href) === this.app.options.outputPaths.vendor.css);
    return throwIfMissing(
      vendorStyle,
      this.app.options.outputPaths.vendor.css,
      styles.map(s => s.href),
      entrypoint,
      'vendor css'
    );
  }

  findTestSupportStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => this.withoutRootURL(style.href) === this.app.options.outputPaths.testSupport.css);
  }

  findTestSupportScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(
      script => this.withoutRootURL(script.src) === this.app.options.outputPaths.testSupport.js.testSupport
    );
  }

  findTestScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => this.withoutRootURL(script.src) === this.app.options.outputPaths.tests.js);
  }
}

function throwIfMissing<T>(
  asset: T | undefined,
  needle: string,
  haystack: string[],
  entryfile: string,
  context: string
): T {
  if (!asset) {
    throw new Error(
      `Could not find ${context}: "${needle}" in ${entryfile}. Found the following instead:\n${haystack
        .map(asset => ` - ${asset}`)
        .join(
          '\n'
        )}\n\nFor more information about this error: https://github.com/thoov/stitch/wiki/Could-not-find-asset-in-entry-file-error-help`
    );
  }

  return asset;
}

class V1DummyApp extends V1App {
  constructor(app: EmberApp, packageCache: PackageCache) {
    super(app, packageCache);
    this.owningAddon = new OwningAddon(this.app.project.root, packageCache);
    this.packageCache.seed(this.owningAddon);
    this.packageCache.seed(new DummyPackage(this.root, this.owningAddon, this.packageCache));
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
  preprocessJs(tree: Node, a: string, b: string, options: object): Node;
  preprocessCss(tree: Node, a: string, b: string, options: object): Node;
}
