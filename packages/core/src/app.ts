import { AppMeta } from './metadata';
import { OutputPaths } from './wait-for-trees';
import { compile } from './js-handlebars';
import Package, { V2AddonPackage } from './package';
import resolve from 'resolve';
import { Memoize } from 'typescript-memoize';
import { writeFileSync, ensureDirSync, copySync, unlinkSync, statSync, readJSONSync } from 'fs-extra';
import { join, dirname, sep, resolve as resolvePath, relative } from 'path';
import { debug, warn } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import AppDiffer from './app-differ';
import { PreparedEmberHTML } from './ember-html';
import { Asset, EmberAsset, InMemoryAsset, OnDiskAsset, ImplicitAssetPaths } from './asset';
import assertNever from 'assert-never';
import SourceMapConcat from 'fast-sourcemap-concat';
import Options from './options';
import { MacrosConfig } from '@embroider/macros';
import { TransformOptions, PluginItem } from '@babel/core';
import PortableBabelConfig from './portable-babel-config';
import { TemplateCompilerPlugins } from '.';
import TemplateCompiler from './template-compiler';
import { Resolver } from './resolver';
import { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import { tmpdir } from 'os';
import { explicitRelative, extensionsPattern } from './paths';
import merge from 'lodash/merge';
import { mangledEngineRoot } from './engine-mangler';
import { AppFiles, RouteFiles, EngineSummary, Engine } from './app-files';

export type EmberENV = unknown;

/*
  This interface is the boundary between the general-purpose build system in
  AppBuilder and the messy specifics of apps.

    - CompatAppAdapter in `@embroider/compat` implements this interface for
      building based of a legacy ember-cli EmberApp instance
    - We will want to make a different class that implements this interface for
      building apps that don't need an EmberApp instance at all (presumably
      because they opt into new authoring standards.
*/
export interface AppAdapter<TreeNames> {
  // the set of all addon packages that are active (recursive)
  readonly allActiveAddons: V2AddonPackage[];

  // the direct active addon dependencies of a given package
  activeAddonChildren(pkg: Package): V2AddonPackage[];

  // path to the directory where the app's own Javascript lives. Doesn't include
  // any files copied out of addons, we take care of that generically in
  // AppBuilder.
  appJSSrcDir(treePaths: OutputPaths<TreeNames>): string;

  // this is where you declare what assets must be in the final output
  // (especially index.html, tests/index.html, and anything from your classic
  // public tree).
  assets(treePaths: OutputPaths<TreeNames>): Asset[];

  // whether the ember app should boot itself automatically
  autoRun(): boolean;

  // custom app-boot logic when the autoRun is set to false
  appBoot(): string | undefined;

  // the ember app's main module
  mainModule(): string;

  // the configuration that will get passed into the ember app's main module.
  // This traditionally comes from the `APP` property returned by
  // config/environment.js.
  mainModuleConfig(): unknown;

  // The namespace for the app's own modules at runtime.
  //
  // (For apps, we _do_ still allow this to be arbitrary. This is in contrast
  // with _addons_, which absolutley must use their real NPM package name as
  // their modulePrefix.)
  modulePrefix(): string;

  // The public URL at which your app will be served.
  rootURL(): string;

  // The path to ember's template compiler source
  templateCompilerPath(): string;

  // Path to a build-time Resolver module to be used during template
  // compilation.
  templateResolver(): Resolver;

  // the list of file extensions that should be considered resolvable as modules
  // within this app. For example: ['.js', '.ts'].
  resolvableExtensions(): string[];

  // The template preprocessor plugins that are configured in the app.
  htmlbarsPlugins(): TemplateCompilerPlugins;

  // the app's preferred babel config. No need to worry about making it portable
  // yet, we will do that for you.
  babelConfig(): TransformOptions;

  // the babel version that works with your babelConfig.
  babelMajorVersion(): 6 | 7;

  // lets you add imports to javascript modules. We need this to implement
  // things like our addon compatibility rules for static components.
  extraImports(): { absPath: string; target: string; runtimeName?: string }[];

  // The environment settings used to control Ember itself. In a classic app,
  // this comes from the EmberENV property returned by config/environment.js.
  emberENV(): EmberENV;

  // when true, the app's own code is understood to already follow v2 standards.
  // For example, all imports of templates have an explicit `hbs` extension, and
  // all imports of your own package use relative imports instead of you rown
  // name. When false, your code is treated more leniently and you get the
  // auto-upgraded behaviors that v1 addons also get.
  strictV2Format(): boolean;
}

export function excludeDotFiles(files: string[]) {
  return files.filter(file => !file.startsWith('.') && !file.includes('/.'));
}

class ParsedEmberAsset {
  kind: 'parsed-ember' = 'parsed-ember';
  relativePath: string;
  fileAsset: EmberAsset;
  html: PreparedEmberHTML;

  constructor(asset: EmberAsset) {
    this.fileAsset = asset;
    this.html = new PreparedEmberHTML(asset);
    this.relativePath = asset.relativePath;
  }

  validFor(other: EmberAsset) {
    return this.fileAsset.mtime === other.mtime && this.fileAsset.size === other.size;
  }
}

class BuiltEmberAsset {
  kind: 'built-ember' = 'built-ember';
  relativePath: string;
  parsedAsset: ParsedEmberAsset;
  source: string;

  constructor(asset: ParsedEmberAsset) {
    this.parsedAsset = asset;
    this.source = asset.html.dom.serialize();
    this.relativePath = asset.relativePath;
  }
}

class ConcatenatedAsset {
  kind: 'concatenated-asset' = 'concatenated-asset';
  constructor(
    public relativePath: string,
    public sources: (OnDiskAsset | InMemoryAsset)[],
    private resolvableExtensions: RegExp
  ) {}
  get sourcemapPath() {
    return this.relativePath.replace(this.resolvableExtensions, '') + '.map';
  }
}

type InternalAsset = OnDiskAsset | InMemoryAsset | BuiltEmberAsset | ConcatenatedAsset;

export class AppBuilder<TreeNames> {
  // for each relativePath, an Asset we have already emitted
  private assets: Map<string, InternalAsset> = new Map();

  constructor(
    private root: string,
    private app: Package,
    private adapter: AppAdapter<TreeNames>,
    private options: Required<Options>,
    private macrosConfig: MacrosConfig
  ) {
    macrosConfig.setOwnConfig(__filename, { active: true });
  }

  private scriptPriority(pkg: Package) {
    switch (pkg.name) {
      case 'loader.js':
        return 0;
      case 'ember-source':
        return 10;
      default:
        return 1000;
    }
  }

  @Memoize()
  private get resolvableExtensionsPattern(): RegExp {
    return extensionsPattern(this.adapter.resolvableExtensions());
  }

  private impliedAssets(
    type: keyof ImplicitAssetPaths,
    addons: V2AddonPackage[],
    emberENV?: EmberENV
  ): (OnDiskAsset | InMemoryAsset)[] {
    let result: (OnDiskAsset | InMemoryAsset)[] = this.impliedAddonAssets(type, addons).map(
      (sourcePath: string): OnDiskAsset => {
        let stats = statSync(sourcePath);
        return {
          kind: 'on-disk',
          relativePath: explicitRelative(this.root, sourcePath),
          sourcePath,
          mtime: stats.mtimeMs,
          size: stats.size,
        };
      }
    );
    if (type === 'implicit-scripts') {
      result.unshift({
        kind: 'in-memory',
        relativePath: '_testing_prefix_.js',
        source: `var runningTests=false;`,
      });

      result.unshift({
        kind: 'in-memory',
        relativePath: '_ember_env_.js',
        source: `window.EmberENV=${JSON.stringify(emberENV, null, 2)};`,
      });
    }
    return result;
  }

  private impliedAddonAssets(type: keyof ImplicitAssetPaths, addons: V2AddonPackage[]): string[] {
    let result: Array<string> = [];
    for (let addon of sortBy(addons, this.scriptPriority.bind(this))) {
      let implicitScripts = addon.meta[type];
      // do not include styles from lazy engines as they will
      // bring in their own styles
      if (implicitScripts) {
        let styles = [];
        let options = { basedir: addon.root };
        for (let mod of implicitScripts) {
          if (type === 'implicit-styles') {
            styles.push(resolve.sync(mod, options));
          } else {
            result.push(resolve.sync(mod, options));
          }
        }
        if (styles.length) {
          result = [...styles, ...result];
        }
      }
    }
    return result;
  }

  @Memoize()
  private babelConfig(templateCompiler: TemplateCompiler, appFiles: Engine[]) {
    let babel = this.adapter.babelConfig();

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(
      require.resolve(
        this.adapter.babelMajorVersion() === 6
          ? 'babel-plugin-syntax-dynamic-import'
          : '@babel/plugin-syntax-dynamic-import'
      )
    );

    // this is @embroider/macros configured for full stage3 resolution
    babel.plugins.push(this.macrosConfig.babelPluginConfig());

    // this is our built-in support for the inline hbs macro
    babel.plugins.push([
      join(__dirname, 'babel-plugin-inline-hbs.js'),
      {
        templateCompiler,
        stage: 3,
      },
    ]);

    babel.plugins.push(this.adjustImportsPlugin(appFiles));
    babel.plugins.push([require.resolve('./template-colocation-plugin')]);

    return new PortableBabelConfig(babel, { basedir: this.root });
  }

  private adjustImportsPlugin(engines: Engine[]): PluginItem {
    let renamePackages = Object.assign({}, ...this.adapter.allActiveAddons.map(dep => dep.meta['renamed-packages']));

    let renameModules = Object.assign({}, ...this.adapter.allActiveAddons.map(dep => dep.meta['renamed-modules']));

    let activeAddons: AdjustImportsOptions['activeAddons'] = {};
    for (let addon of this.adapter.allActiveAddons) {
      activeAddons[addon.name] = addon.root;
    }

    let relocatedFiles: AdjustImportsOptions['relocatedFiles'] = {};
    for (let { destPath, appFiles } of engines) {
      for (let [relativePath, originalPath] of appFiles.relocatedFiles) {
        relocatedFiles[
          join(destPath, relativePath)
            .split(sep)
            .join('/')
        ] = originalPath;
      }
    }

    let adjustOptions: AdjustImportsOptions = {
      activeAddons,
      renameModules,
      renamePackages,
      extraImports: this.adapter.extraImports(),
      relocatedFiles,
      resolvableExtensions: this.adapter.resolvableExtensions(),

      // it's important that this is a persistent location, because we fill it
      // up as a side-effect of babel transpilation, and babel is subject to
      // persistent caching.
      externalsDir: join(tmpdir(), 'embroider', 'externals'),
    };
    return [require.resolve('./babel-plugin-adjust-imports'), adjustOptions];
  }

  private insertEmberApp(
    asset: ParsedEmberAsset,
    appFiles: Engine[],
    prepared: Map<string, InternalAsset>,
    emberENV: EmberENV
  ) {
    let html = asset.html;

    // our tests entrypoint already includes a correct module dependency on the
    // app, so we only insert the app when we're not inserting tests
    if (!asset.fileAsset.includeTests) {
      let appJS = this.topAppJSAsset(appFiles, prepared);
      html.insertScriptTag(html.javascript, appJS.relativePath, { type: 'module' });
    }

    html.insertStyleLink(html.styles, `assets/${this.app.name}.css`);

    let implicitScripts = this.impliedAssets('implicit-scripts', Array.from(appFiles[0].addons), emberENV);
    if (implicitScripts.length > 0) {
      let vendorJS = new ConcatenatedAsset('assets/vendor.js', implicitScripts, this.resolvableExtensionsPattern);
      prepared.set(vendorJS.relativePath, vendorJS);
      html.insertScriptTag(html.implicitScripts, vendorJS.relativePath);
    }

    let addonList = Array.from(appFiles[0].addons);
    addonList = addonList.filter(addon => !addon.meta['lazy-engine']);
    let implicitStyles = this.impliedAssets('implicit-styles', addonList);
    if (implicitStyles.length > 0) {
      let vendorCSS = new ConcatenatedAsset('assets/vendor.css', implicitStyles, this.resolvableExtensionsPattern);
      prepared.set(vendorCSS.relativePath, vendorCSS);
      html.insertStyleLink(html.implicitStyles, vendorCSS.relativePath);
    }

    if (asset.fileAsset.includeTests) {
      let testJS = prepared.get(`assets/test.js`);
      if (!testJS) {
        testJS = this.testJSEntrypoint(appFiles, prepared);
        prepared.set(testJS.relativePath, testJS);
      }
      html.insertScriptTag(html.testJavascript, testJS.relativePath, { type: 'module' });

      let implicitTestScripts = this.impliedAssets('implicit-test-scripts', Array.from(appFiles[0].addons));
      if (implicitTestScripts.length > 0) {
        // this is the traditional test-support-suffix.js, it should go to test-support
        implicitTestScripts.push({
          kind: 'in-memory',
          relativePath: '_testing_suffix_.js',
          source: `
          var runningTests=true;
          if (window.Testem) {
            window.Testem.hookIntoTestFramework();
          }`,
        });
        let testSupportJS = new ConcatenatedAsset(
          'assets/test-support.js',
          implicitTestScripts,
          this.resolvableExtensionsPattern
        );
        prepared.set(testSupportJS.relativePath, testSupportJS);
        html.insertScriptTag(html.implicitTestScripts, testSupportJS.relativePath);
      }

      let implicitTestStyles = this.impliedAssets('implicit-test-styles', Array.from(appFiles[0].addons));
      if (implicitTestStyles.length > 0) {
        let testSupportCSS = new ConcatenatedAsset(
          'assets/test-support.css',
          implicitTestStyles,
          this.resolvableExtensionsPattern
        );
        prepared.set(testSupportCSS.relativePath, testSupportCSS);
        html.insertStyleLink(html.implicitTestStyles, testSupportCSS.relativePath);
      }
    }
  }

  // recurse to find all active addons that don't cross an engine boundary.
  // Inner engines themselves will be returned, but not those engines' children.
  // The output set's insertion order is the proper ember-cli compatible
  // ordering of the addons.
  private findActiveAddons(pkg: Package, engine: EngineSummary): void {
    for (let child of this.adapter.activeAddonChildren(pkg)) {
      if (!child.isEngine()) {
        this.findActiveAddons(child, engine);
      }
      engine.addons.add(child);
    }
  }

  private partitionEngines(appJSPath: string): EngineSummary[] {
    let queue: EngineSummary[] = [
      {
        package: this.app,
        addons: new Set(),
        parent: undefined,
        sourcePath: appJSPath,
        destPath: this.root,
        modulePrefix: this.modulePrefix,
        appRelativePath: '.',
      },
    ];
    let done: EngineSummary[] = [];
    let seenEngines: Set<Package> = new Set();
    while (true) {
      let current = queue.shift();
      if (!current) {
        break;
      }
      this.findActiveAddons(current.package, current);
      for (let addon of current.addons) {
        if (addon.isEngine() && !seenEngines.has(addon)) {
          seenEngines.add(addon);
          queue.push({
            package: addon,
            addons: new Set(),
            parent: current,
            sourcePath: mangledEngineRoot(addon),
            destPath: addon.root,
            modulePrefix: addon.name,
            appRelativePath: explicitRelative(this.root, addon.root),
          });
        }
      }
      done.push(current);
    }
    return done;
  }

  private appDiffers: { differ: AppDiffer; engine: EngineSummary }[] | undefined;

  private updateAppJS(appJSPath: string): Engine[] {
    if (!this.appDiffers) {
      let engines = this.partitionEngines(appJSPath);
      this.appDiffers = engines.map(engine => ({
        differ: new AppDiffer(engine.destPath, engine.sourcePath, [...engine.addons]),
        engine,
      }));
    }
    // this is in reverse order because we need deeper engines to update before
    // their parents, because they aren't really valid packages until they
    // update, and their parents will go looking for their own `app-js` content.
    this.appDiffers
      .slice()
      .reverse()
      .forEach(a => a.differ.update());
    return this.appDiffers.map(a => {
      return Object.assign({}, a.engine, {
        appFiles: new AppFiles(a.differ.files, this.resolvableExtensionsPattern),
      });
    });
  }

  private prepareAsset(asset: Asset, appFiles: Engine[], prepared: Map<string, InternalAsset>, emberENV: EmberENV) {
    if (asset.kind === 'ember') {
      let prior = this.assets.get(asset.relativePath);
      let parsed: ParsedEmberAsset;
      if (prior && prior.kind === 'built-ember' && prior.parsedAsset.validFor(asset)) {
        // we can reuse the parsed html
        parsed = prior.parsedAsset;
        parsed.html.clear();
      } else {
        parsed = new ParsedEmberAsset(asset);
      }
      this.insertEmberApp(parsed, appFiles, prepared, emberENV);
      prepared.set(asset.relativePath, new BuiltEmberAsset(parsed));
    } else {
      prepared.set(asset.relativePath, asset);
    }
  }

  private prepareAssets(requestedAssets: Asset[], appFiles: Engine[], emberENV: EmberENV): Map<string, InternalAsset> {
    let prepared: Map<string, InternalAsset> = new Map();
    for (let asset of requestedAssets) {
      this.prepareAsset(asset, appFiles, prepared, emberENV);
    }
    return prepared;
  }

  private assetIsValid(asset: InternalAsset, prior: InternalAsset | undefined): boolean {
    if (!prior) {
      return false;
    }
    switch (asset.kind) {
      case 'on-disk':
        return prior.kind === 'on-disk' && prior.size === asset.size && prior.mtime === asset.mtime;
      case 'in-memory':
        return prior.kind === 'in-memory' && stringOrBufferEqual(prior.source, asset.source);
      case 'built-ember':
        return prior.kind === 'built-ember' && prior.source === asset.source;
      case 'concatenated-asset':
        return (
          prior.kind === 'concatenated-asset' &&
          prior.sources.length === asset.sources.length &&
          prior.sources.every((priorFile, index) => {
            let newFile = asset.sources[index];
            return this.assetIsValid(newFile, priorFile);
          })
        );
    }
    assertNever(asset);
  }

  private updateOnDiskAsset(asset: OnDiskAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    copySync(asset.sourcePath, destination, { dereference: true });
  }

  private updateInMemoryAsset(asset: InMemoryAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private updateBuiltEmberAsset(asset: BuiltEmberAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private async updateConcatenatedAsset(asset: ConcatenatedAsset) {
    let concat = new SourceMapConcat({
      outputFile: join(this.root, asset.relativePath),
      mapCommentType: asset.relativePath.endsWith('.js') ? 'line' : 'block',
      baseDir: this.root,
    });
    if (process.env.EMBROIDER_CONCAT_STATS) {
      let MeasureConcat = (await import('./measure-concat')).default;
      concat = new MeasureConcat(asset.relativePath, concat, this.root);
    }
    for (let source of asset.sources) {
      switch (source.kind) {
        case 'on-disk':
          concat.addFile(explicitRelative(this.root, source.sourcePath));
          break;
        case 'in-memory':
          if (typeof source.source !== 'string') {
            throw new Error(`attempted to concatenated a Buffer-backed in-memory asset`);
          }
          concat.addSpace(source.source);
          break;
        default:
          assertNever(source);
      }
    }
    await concat.end();
  }

  private async updateAssets(requestedAssets: Asset[], appFiles: Engine[], emberENV: EmberENV) {
    let assets = this.prepareAssets(requestedAssets, appFiles, emberENV);
    for (let asset of assets.values()) {
      if (this.assetIsValid(asset, this.assets.get(asset.relativePath))) {
        continue;
      }
      debug('rebuilding %s', asset.relativePath);
      switch (asset.kind) {
        case 'on-disk':
          this.updateOnDiskAsset(asset);
          break;
        case 'in-memory':
          this.updateInMemoryAsset(asset);
          break;
        case 'built-ember':
          this.updateBuiltEmberAsset(asset);
          break;
        case 'concatenated-asset':
          await this.updateConcatenatedAsset(asset);
          break;
        default:
          assertNever(asset);
      }
    }
    for (let oldAsset of this.assets.values()) {
      if (!assets.has(oldAsset.relativePath)) {
        unlinkSync(join(this.root, oldAsset.relativePath));
      }
    }
    this.assets = assets;
    return [...assets.values()];
  }

  private gatherAssets(inputPaths: OutputPaths<TreeNames>): Asset[] {
    // first gather all the assets out of addons
    let assets: Asset[] = [];
    for (let pkg of this.adapter.allActiveAddons) {
      if (pkg.meta['public-assets']) {
        for (let [filename, appRelativeURL] of Object.entries(pkg.meta['public-assets'] || {})) {
          let sourcePath = resolvePath(pkg.root, filename);
          let stats = statSync(sourcePath);
          assets.push({
            kind: 'on-disk',
            sourcePath,
            relativePath: appRelativeURL,
            mtime: stats.mtimeMs,
            size: stats.size,
          });
        }
      }
    }
    // and finally tack on the ones from our app itself
    return assets.concat(this.adapter.assets(inputPaths));
  }

  // This supports a slightly weird thing used (AFAIK) only by
  // ember-cli-fastboot. ember-cli-fastboot emits a package.json file in its
  // treeForPublic, which means in embroider terms it has a public-asset named
  // "package.json". It wants that to be in the final build output.
  //
  // We can't let it just overwrite our own stage2 package.json because we use
  // that for our own purposes. So we make it our policy that any time an addon
  // emits a public-asset named package.json, we will merge it into our
  // package.json. This is enough to make ember-cli-fastboot happy.
  private gatherPackageJson(assets: Asset[]) {
    let found = [] as object[];
    for (let asset of assets) {
      if (asset.relativePath === 'package.json') {
        switch (asset.kind) {
          case 'on-disk':
            found.push(readJSONSync(asset.sourcePath));
            break;
          case 'in-memory':
            if (typeof asset.source === 'string') {
              found.push(JSON.parse(asset.source));
            } else {
              found.push(JSON.parse(asset.source.toString('utf8')));
            }
            break;
          case 'ember':
            // deliberately skipped. An ember entrypoint asset can never be JSON.
            break;
          default:
            assertNever(asset);
        }
      }
    }
    return found;
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.macrosConfig.finalize();

    let appFiles = this.updateAppJS(this.adapter.appJSSrcDir(inputPaths));
    let emberENV = this.adapter.emberENV();
    let assets = this.gatherAssets(inputPaths);

    let finalAssets = await this.updateAssets(assets, appFiles, emberENV);
    let templateCompiler = this.templateCompiler(emberENV);
    let babelConfig = this.babelConfig(templateCompiler, appFiles);
    this.addTemplateCompiler(templateCompiler);
    this.addBabelConfig(babelConfig);

    let assetPaths = assets.map(asset => asset.relativePath);
    for (let asset of finalAssets) {
      // our concatenated assets all have map files that ride along. Here we're
      // telling the final stage packager to be sure and serve the map files
      // too.
      if (asset.kind === 'concatenated-asset') {
        assetPaths.push(asset.sourcemapPath);
      }
    }

    let meta: AppMeta = {
      type: 'app',
      version: 2,
      assets: assetPaths,
      'template-compiler': {
        filename: '_template_compiler_.js',
        isParallelSafe: templateCompiler.isParallelSafe,
      },
      babel: {
        filename: '_babel_config_.js',
        isParallelSafe: babelConfig.isParallelSafe,
        majorVersion: this.adapter.babelMajorVersion(),
        fileFilter: '_babel_filter_.js',
      },
      'resolvable-extensions': this.adapter.resolvableExtensions(),
      'root-url': this.adapter.rootURL(),
    };

    if (!this.adapter.strictV2Format()) {
      meta['auto-upgraded'] = true;
    }

    let pkg = cloneDeep(this.app.packageJSON);
    if (pkg.keywords) {
      if (!pkg.keywords.includes('ember-addon')) {
        pkg.keywords.push('ember-addon');
      }
    } else {
      pkg.keywords = ['ember-addon'];
    }
    pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], meta);
    const pkgPath = join(this.root, 'package.json');
    let addonProvidedPackageJSONS = this.gatherPackageJson(assets);
    if (addonProvidedPackageJSONS.length > 0) {
      pkg = merge({}, ...addonProvidedPackageJSONS, pkg);
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  }

  private templateCompiler(config: EmberENV) {
    let plugins = this.adapter.htmlbarsPlugins();
    if (!plugins.ast) {
      plugins.ast = [];
    }
    let { plugins: macroPlugins, setConfig } = MacrosConfig.astPlugins();
    setConfig(this.macrosConfig);
    for (let macroPlugin of macroPlugins) {
      plugins.ast.push(macroPlugin);
    }

    return new TemplateCompiler({
      plugins,
      compilerPath: resolve.sync(this.adapter.templateCompilerPath(), { basedir: this.root }),
      resolver: this.adapter.templateResolver(),
      EmberENV: config,
    });
  }

  private addTemplateCompiler(templateCompiler: TemplateCompiler) {
    writeFileSync(join(this.root, '_template_compiler_.js'), templateCompiler.serialize(), 'utf8');
  }

  private addBabelConfig(babelConfig: PortableBabelConfig) {
    if (!babelConfig.isParallelSafe) {
      warn('Your build is slower because some babel plugins are non-serializable');
    }
    writeFileSync(join(this.root, '_babel_config_.js'), babelConfig.serialize(), 'utf8');
    writeFileSync(
      join(this.root, '_babel_filter_.js'),
      babelFilterTemplate({ skipBabel: this.options.skipBabel }),
      'utf8'
    );
  }

  private shouldSplitRoute(routeName: string) {
    return (
      !this.options.splitAtRoutes ||
      this.options.splitAtRoutes.find(pattern => {
        if (typeof pattern === 'string') {
          return pattern === routeName;
        } else {
          return pattern.test(routeName);
        }
      })
    );
  }

  private splitRoute(
    routeName: string,
    files: RouteFiles,
    addToParent: (routeName: string, filename: string) => void,
    addLazyBundle: (routeNames: string[], files: string[]) => void
  ) {
    let shouldSplit = routeName && this.shouldSplitRoute(routeName);
    let ownFiles = [];
    let ownNames = new Set() as Set<string>;

    if (files.template) {
      if (shouldSplit) {
        ownFiles.push(files.template);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.template);
      }
    }

    if (files.controller) {
      if (shouldSplit) {
        ownFiles.push(files.controller);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.controller);
      }
    }

    if (files.route) {
      if (shouldSplit) {
        ownFiles.push(files.route);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.route);
      }
    }

    for (let [childName, childFiles] of files.children) {
      this.splitRoute(
        `${routeName}.${childName}`,
        childFiles,

        (childRouteName: string, childFile: string) => {
          // this is our child calling "addToParent"
          if (shouldSplit) {
            ownFiles.push(childFile);
            ownNames.add(childRouteName);
          } else {
            addToParent(childRouteName, childFile);
          }
        },
        (routeNames: string[], files: string[]) => {
          addLazyBundle(routeNames, files);
        }
      );
    }

    if (ownFiles.length > 0) {
      addLazyBundle([...ownNames], ownFiles);
    }
  }

  private topAppJSAsset(engines: Engine[], prepared: Map<string, InternalAsset>): InternalAsset {
    let [app, ...childEngines] = engines;
    let relativePath = `assets/${this.app.name}.js`;
    return this.appJSAsset(relativePath, app, childEngines, prepared, {
      autoRun: this.adapter.autoRun(),
      appBoot: !this.adapter.autoRun() ? this.adapter.appBoot() : '',
      mainModule: explicitRelative(dirname(relativePath), this.adapter.mainModule()),
      appConfig: this.adapter.mainModuleConfig(),
    });
  }

  private appJSAsset(
    relativePath: string,
    engine: Engine,
    childEngines: Engine[],
    prepared: Map<string, InternalAsset>,
    entryParams?: Partial<Parameters<typeof entryTemplate>[0]>,
    additionEagerModules?: string[]
  ): InternalAsset {
    let { appFiles } = engine;
    let cached = prepared.get(relativePath);
    if (cached) {
      return cached;
    }

    let eagerModules = [];
    let requiredAppFiles = [appFiles.otherAppFiles];
    if (!this.options.staticComponents) {
      requiredAppFiles.push(appFiles.components);
    }
    if (!this.options.staticHelpers) {
      requiredAppFiles.push(appFiles.helpers);
    }

    let lazyEngines: { names: string[]; path: string }[] = [];
    for (let childEngine of childEngines) {
      let implicitStyles: string[] = [];
      if (childEngine.package.isLazyEngine()) {
        let addonList = Array.from(childEngine.addons);
        addonList.push(childEngine.package as V2AddonPackage);
        implicitStyles = this.impliedAddonAssets('implicit-styles', addonList);
      }

      let asset = this.appJSAsset(
        `assets/_engine_/${encodeURIComponent(childEngine.package.name)}.js`,
        childEngine,
        [],
        prepared,
        undefined,
        implicitStyles
      );
      if (childEngine.package.isLazyEngine()) {
        lazyEngines.push({
          names: [childEngine.package.name],
          path: explicitRelative(dirname(relativePath), asset.relativePath),
        });
      } else {
        eagerModules.push(explicitRelative(dirname(relativePath), asset.relativePath));
      }
    }

    if (Array.isArray(additionEagerModules) && additionEagerModules.length > 0) {
      additionEagerModules.forEach(assetPath => {
        eagerModules.push(relative(join(this.root, dirname(relativePath)), assetPath));
      });
    }

    let lazyRoutes: { names: string[]; path: string }[] = [];
    for (let [routeName, routeFiles] of appFiles.routeFiles.children) {
      this.splitRoute(
        routeName,
        routeFiles,
        (_: string, filename: string) => {
          requiredAppFiles.push([filename]);
        },
        (routeNames: string[], files: string[]) => {
          let routeEntrypoint = `assets/_route_/${encodeURIComponent(routeNames[0])}.js`;
          if (!prepared.has(routeEntrypoint)) {
            prepared.set(routeEntrypoint, this.routeEntrypoint(engine, routeEntrypoint, files));
          }
          lazyRoutes.push({
            names: routeNames,
            path: this.importPaths(engine, routeEntrypoint, relativePath).buildtime,
          });
        }
      );
    }

    let amdModules = excludeDotFiles(flatten(requiredAppFiles)).map(file =>
      this.importPaths(engine, file, relativePath)
    );

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', relativePath, engine, amdModules);

    let params = { amdModules, lazyRoutes, lazyEngines, eagerModules };
    if (entryParams) {
      Object.assign(params, entryParams);
    }

    let source = entryTemplate(params);

    let asset: InternalAsset = {
      kind: 'in-memory',
      source,
      relativePath,
    };
    prepared.set(relativePath, asset);
    return asset;
  }

  @Memoize()
  private get modulePrefix() {
    return this.adapter.modulePrefix();
  }

  private importPaths(engine: Engine, engineRelativePath: string, fromFile: string) {
    let appRelativePath = join(engine.appRelativePath, engineRelativePath);
    let noJS = appRelativePath.replace(this.resolvableExtensionsPattern, '');
    let noHBS = engineRelativePath.replace(this.resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
    return {
      runtime: `${engine.modulePrefix}/${noHBS}`,
      buildtime: explicitRelative(dirname(fromFile), noJS),
    };
  }

  private routeEntrypoint(engine: Engine, relativePath: string, files: string[]) {
    let asset: InternalAsset = {
      kind: 'in-memory',
      source: routeEntryTemplate({
        files: files.map(f => this.importPaths(engine, f, relativePath)),
      }),
      relativePath,
    };
    return asset;
  }

  private testJSEntrypoint(engines: Engine[], prepared: Map<string, InternalAsset>): InternalAsset {
    // We're only building tests from the first engine (the app). This is the
    // normal thing to do -- tests from engines don't automatically roll up into
    // the app.
    let engine = engines[0];

    let { appFiles } = engine;
    const myName = 'assets/test.js';
    let testModules = appFiles.tests
      .map(relativePath => {
        return `../${relativePath}`;
      })
      .filter(Boolean) as string[];

    // tests necessarily also include the app. This is where we account for
    // that. The classic solution was to always include the app's separate
    // script tag in the tests HTML, but that isn't as easy for final stage
    // packagers to understand. It's better to express it here as a direct
    // module dependency.
    testModules.unshift(explicitRelative(dirname(myName), this.topAppJSAsset(engines, prepared).relativePath));

    let amdModules: { runtime: string; buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', myName, engine, amdModules);

    let source = entryTemplate({
      amdModules,
      eagerModules: testModules,
      testSuffix: true,
    });

    return {
      kind: 'in-memory',
      source,
      relativePath: myName,
    };
  }

  private gatherImplicitModules(
    section: 'implicit-modules' | 'implicit-test-modules',
    relativeTo: string,
    engine: Engine,
    lazyModules: { runtime: string; buildtime: string }[]
  ) {
    for (let addon of engine.addons) {
      let implicitModules = addon.meta[section];
      if (implicitModules) {
        let renamedModules = inverseRenamedModules(addon.meta, this.resolvableExtensionsPattern);
        for (let name of implicitModules) {
          let runtime = join(addon.name, name).replace(this.resolvableExtensionsPattern, '');
          if (renamedModules && renamedModules[runtime]) {
            runtime = renamedModules[runtime];
          }
          runtime = runtime.split(sep).join('/');
          lazyModules.push({
            runtime,
            buildtime: explicitRelative(dirname(join(this.root, relativeTo)), join(addon.root, name)),
          });
        }
      }
    }
  }
}

const entryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let w = window;
let d = w.define;

{{#each amdModules as |amdModule| ~}}
  d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}

{{#each eagerModules as |eagerModule| ~}}
  i("{{js-string-escape eagerModule}}");
{{/each}}

{{#if lazyRoutes}}
w._embroiderRouteBundles_ = [
  {{#each lazyRoutes as |route|}}
  {
    names: {{{json-stringify route.names}}},
    load: function() {
      return import("{{js-string-escape route.path}}");
    }
  },
  {{/each}}
]
{{/if}}

{{#if lazyEngines}}
w._embroiderEngineBundles_ = [
  {{#each lazyEngines as |engine|}}
  {
    names: {{{json-stringify engine.names}}},
    load: function() {
      return import("{{js-string-escape engine.path}}");
    }
  },
  {{/each}}
]
{{/if}}

{{#if autoRun ~}}
if (!runningTests) {
  i("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
}
{{else  if appBoot ~}}
  {{{ appBoot }}}
{{/if}}

{{#if testSuffix ~}}
  {{!- TODO: both of these suffixes should get dynamically generated so they incorporate
       any content-for added by addons. -}}


  {{!- this is the traditional tests-suffix.js -}}
  i('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`) as (params: {
  amdModules?: ({ runtime: string; buildtime: string })[];
  eagerModules?: string[];
  autoRun?: boolean;
  appBoot?: string;
  mainModule?: string;
  appConfig?: unknown;
  testSuffix?: boolean;
  lazyRoutes?: { names: string[]; path: string }[];
  lazyEngines?: { names: string[]; path: string }[];
}) => string;

const routeEntryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let d = window.define;
{{#each files as |amdModule| ~}}
d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}
`) as (params: { files: { runtime: string; buildtime: string }[] }) => string;

function stringOrBufferEqual(a: string | Buffer, b: string | Buffer): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (a instanceof Buffer && b instanceof Buffer) {
    return Buffer.compare(a, b) === 0;
  }
  return false;
}

const babelFilterTemplate = compile(`
const { babelFilter } = require('@embroider/core');
module.exports = babelFilter({{{json-stringify skipBabel}}});
`) as (params: { skipBabel: Options['skipBabel'] }) => string;

// meta['renamed-modules'] has mapping from classic filename to real filename.
// This takes that and converts it to the inverst mapping from real import path
// to classic import path.
function inverseRenamedModules(meta: V2AddonPackage['meta'], extensions: RegExp) {
  let renamed = meta['renamed-modules'];
  if (renamed) {
    let inverted = {} as { [name: string]: string };
    for (let [classic, real] of Object.entries(renamed)) {
      inverted[real.replace(extensions, '')] = classic.replace(extensions, '');
    }
    return inverted;
  }
}
