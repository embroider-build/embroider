import {
  AddonMeta,
  AppMeta,
  Package,
  AddonPackage,
  explicitRelative,
  extensionsPattern,
} from '@embroider/shared-internals';
import { OutputPaths } from './wait-for-trees';
import { compile } from './js-handlebars';
import resolve from 'resolve';
import { Memoize } from 'typescript-memoize';
import { copySync, ensureDirSync, readJSONSync, statSync, unlinkSync, writeFileSync } from 'fs-extra';
import { dirname, join, resolve as resolvePath, sep } from 'path';
import { debug, warn } from './messages';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import AppDiffer from './app-differ';
import { PreparedEmberHTML } from './ember-html';
import { Asset, EmberAsset, ImplicitAssetPaths, InMemoryAsset, OnDiskAsset } from './asset';
import assertNever from 'assert-never';
import SourceMapConcat from 'fast-sourcemap-concat';
import Options from './options';
import { MacrosConfig } from '@embroider/macros/src/node';
import { PluginItem, TransformOptions } from '@babel/core';
import { makePortable } from './portable-babel-config';
import { TemplateCompilerPlugins } from '.';
import type { NodeTemplateCompilerParams } from './template-compiler-node';
import { templateCompilerModule } from './write-template-compiler';
import { Resolver } from './resolver';
import { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import { mangledEngineRoot } from './engine-mangler';
import { AppFiles, Engine, EngineSummary, RouteFiles } from './app-files';
import partition from 'lodash/partition';
import mergeWith from 'lodash/mergeWith';
import cloneDeep from 'lodash/cloneDeep';
import type { Params as InlineBabelParams } from './babel-plugin-inline-hbs-node';
import { PortableHint, maybeNodeModuleVersion } from './portable';
import escapeRegExp from 'escape-string-regexp';
import { getEmberExports } from './load-ember-template-compiler';

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
  readonly allActiveAddons: AddonPackage[];

  // the direct active addon dependencies of a given package
  activeAddonChildren(pkg: Package): AddonPackage[];

  // path to the directory where the app's own Javascript lives. Doesn't include
  // any files copied out of addons, we take care of that generically in
  // AppBuilder.
  appJSSrcDir(treePaths: OutputPaths<TreeNames>): string;

  // path to the directory where the app's own Fastboot-only Javascript lives.
  // Doesn't include any files copied out of addons, we take care of that
  // generically in AppBuilder.
  fastbootJSSrcDir(treePaths: OutputPaths<TreeNames>): string | undefined;

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

  // The module prefix when pods file layout is used
  podModulePrefix(): string | undefined;

  // The public URL at which your app will be served.
  rootURL(): string;

  // The path to ember's template compiler source
  templateCompilerPath(): string;

  // Path to a build-time Resolver module to be used during template
  // compilation.
  templateResolver(): Resolver;

  // describes the special module naming rules that we need to achieve
  // compatibility
  adjustImportsOptions(): AdjustImportsOptions;

  // The template preprocessor plugins that are configured in the app.
  htmlbarsPlugins(): TemplateCompilerPlugins;

  // the app's preferred babel config. No need to worry about making it portable
  // yet, we will do that for you.
  babelConfig(): TransformOptions;

  // the babel version that works with your babelConfig.
  babelMajorVersion(): 7;

  // The environment settings used to control Ember itself. In a classic app,
  // this comes from the EmberENV property returned by config/environment.js.
  emberENV(): EmberENV;

  // when true, the app's own code is understood to already follow v2 standards.
  // For example, all imports of templates have an explicit `hbs` extension, and
  // all imports of your own package use relative imports instead of you rown
  // name. When false, your code is treated more leniently and you get the
  // auto-upgraded behaviors that v1 addons also get.
  strictV2Format(): boolean;

  // list of directories that point to the roots of addon packages that are
  // under active development
  developingAddons(): string[];

  // development, test, or production
  env: string;
}

export function excludeDotFiles(files: string[]) {
  return files.filter(file => !file.startsWith('.') && !file.includes('/.'));
}

export const CACHE_BUSTING_PLUGIN = {
  path: require.resolve('./babel-plugin-cache-busting'),
  version: readJSONSync(`${__dirname}/../package.json`).version,
};

export function addCachablePlugin(babelConfig: TransformOptions) {
  if (Array.isArray(babelConfig.plugins) && babelConfig.plugins.length > 0) {
    const plugins = Object.create(null);
    plugins[CACHE_BUSTING_PLUGIN.path] = CACHE_BUSTING_PLUGIN.version;

    for (const plugin of babelConfig.plugins) {
      let absolutePathToPlugin: string;
      if (Array.isArray(plugin) && typeof plugin[0] === 'string') {
        absolutePathToPlugin = plugin[0] as string;
      } else if (typeof plugin === 'string') {
        absolutePathToPlugin = plugin;
      } else {
        throw new Error(`[Embroider] a babel plugin without an absolute path was from: ${plugin}`);
      }

      plugins[absolutePathToPlugin] = maybeNodeModuleVersion(absolutePathToPlugin);
    }

    babelConfig.plugins.push([
      CACHE_BUSTING_PLUGIN.path,
      {
        plugins,
      },
    ]);
  }
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
    // this uses globalConfig because it's a way for packages to ask "is
    // Embroider doing this build?". So it's necessarily global, not scoped to
    // any subgraph of dependencies.
    macrosConfig.setGlobalConfig(__filename, `@embroider/core`, {
      // this is hard-coded to true because it literally means "embroider is
      // building this Ember app". You can see non-true when using the Embroider
      // macros in a classic build.
      active: true,
    });
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
    return extensionsPattern(this.adapter.adjustImportsOptions().resolvableExtensions);
  }

  private impliedAssets(
    type: keyof ImplicitAssetPaths,
    engine: Engine,
    emberENV?: EmberENV
  ): (OnDiskAsset | InMemoryAsset)[] {
    let result: (OnDiskAsset | InMemoryAsset)[] = this.impliedAddonAssets(type, engine).map(
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

      result.push({
        kind: 'in-memory',
        relativePath: '_loader_.js',
        source: `loader.makeDefaultExport=false;`,
      });
    }

    if (type === 'implicit-test-scripts') {
      // this is the traditional test-support-suffix.js
      result.push({
        kind: 'in-memory',
        relativePath: '_testing_suffix_.js',
        source: `
        var runningTests=true;
        if (typeof Testem !== 'undefined' && (typeof QUnit !== 'undefined' || typeof Mocha !== 'undefined')) {
          Testem.hookIntoTestFramework();
        }`,
      });

      // whether or not anybody was actually using @embroider/macros
      // explicitly as an addon, we ensure its test-support file is always
      // present.
      if (!result.find(s => s.kind === 'on-disk' && s.sourcePath.endsWith('embroider-macros-test-support.js'))) {
        result.unshift({
          kind: 'on-disk',
          sourcePath: require.resolve('@embroider/macros/src/vendor/embroider-macros-test-support'),
          mtime: 0,
          size: 0,
          relativePath: 'embroider-macros-test-support.js',
        });
      }
    }

    return result;
  }

  private impliedAddonAssets(type: keyof ImplicitAssetPaths, engine: Engine): string[] {
    let result: Array<string> = [];
    for (let addon of sortBy(Array.from(engine.addons), this.scriptPriority.bind(this))) {
      let implicitScripts = addon.meta[type];
      if (implicitScripts) {
        let styles = [];
        let options = { basedir: addon.root };
        for (let mod of implicitScripts) {
          if (type === 'implicit-styles') {
            // exclude engines because they will handle their own css importation
            if (!addon.isLazyEngine()) {
              styles.push(resolve.sync(mod, options));
            }
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

  // unlike our full config, this one just needs to know how to parse all the
  // syntax our app can contain.
  @Memoize()
  private babelParserConfig(): TransformOptions {
    let babel = cloneDeep(this.adapter.babelConfig());

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));
    return babel;
  }

  @Memoize()
  private babelConfig(templateCompilerParams: NodeTemplateCompilerParams, appFiles: Engine[]) {
    let babel = cloneDeep(this.adapter.babelConfig());

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));

    // https://github.com/webpack/webpack/issues/12154
    babel.plugins.push(require.resolve('./rename-require-plugin'));

    // this is our built-in support for the inline hbs macro
    babel.plugins.push([
      join(__dirname, 'babel-plugin-inline-hbs-node.js'),
      {
        templateCompiler: templateCompilerParams,
        stage: 3,
      } as InlineBabelParams,
    ]);

    // this is @embroider/macros configured for full stage3 resolution
    babel.plugins.push(this.macrosConfig.babelPluginConfig());

    babel.plugins.push([require.resolve('./template-colocation-plugin')]);

    babel.plugins.push(this.adjustImportsPlugin(appFiles));

    // we can use globally shared babel runtime by default
    babel.plugins.push([
      require.resolve('@babel/plugin-transform-runtime'),
      { absoluteRuntime: __dirname, useESModules: true, regenerator: false },
    ]);

    const portable = makePortable(babel, { basedir: this.root }, this.portableHints);
    addCachablePlugin(portable.config);
    return portable;
  }

  private adjustImportsPlugin(engines: Engine[]): PluginItem {
    let relocatedFiles: AdjustImportsOptions['relocatedFiles'] = {};
    for (let { destPath, appFiles } of engines) {
      for (let [relativePath, originalPath] of appFiles.relocatedFiles) {
        relocatedFiles[join(destPath, relativePath).split(sep).join('/')] = originalPath;
      }
    }
    return [
      require.resolve('./babel-plugin-adjust-imports'),
      Object.assign({}, this.adapter.adjustImportsOptions(), { relocatedFiles }),
    ];
  }

  private insertEmberApp(
    asset: ParsedEmberAsset,
    appFiles: Engine[],
    prepared: Map<string, InternalAsset>,
    emberENV: EmberENV
  ) {
    let html = asset.html;

    if (this.fastbootConfig) {
      // ignore scripts like ember-cli-livereload.js which are not really associated with
      // "the app".
      let ignoreScripts = html.dom.window.document.querySelectorAll('script');
      ignoreScripts.forEach(script => {
        script.setAttribute('data-fastboot-ignore', '');
      });
    }

    // our tests entrypoint already includes a correct module dependency on the
    // app, so we only insert the app when we're not inserting tests
    if (!asset.fileAsset.includeTests) {
      let appJS = this.topAppJSAsset(appFiles, prepared);
      html.insertScriptTag(html.javascript, appJS.relativePath, { type: 'module' });
    }

    if (this.fastbootConfig) {
      // any extra fastboot app files get inserted into our html.javascript
      // section, after the app has been inserted.
      for (let script of this.fastbootConfig.extraAppFiles) {
        html.insertScriptTag(html.javascript, script, { tag: 'fastboot-script' });
      }
    }

    html.insertStyleLink(html.styles, `assets/${this.app.name}.css`);

    const parentEngine = appFiles.find(e => !e.parent) as Engine;
    let vendorJS = this.implicitScriptsAsset(prepared, parentEngine, emberENV);
    if (vendorJS) {
      html.insertScriptTag(html.implicitScripts, vendorJS.relativePath);
    }

    if (this.fastbootConfig) {
      // any extra fastboot vendor files get inserted into our
      // html.implicitScripts section, after the regular implicit script
      // (vendor.js) have been inserted.
      for (let script of this.fastbootConfig.extraVendorFiles) {
        html.insertScriptTag(html.implicitScripts, script, { tag: 'fastboot-script' });
      }
    }

    let implicitStyles = this.implicitStylesAsset(prepared, parentEngine);
    if (implicitStyles) {
      html.insertStyleLink(html.implicitStyles, implicitStyles.relativePath);
    }

    if (!asset.fileAsset.includeTests) {
      return;
    }

    // Test-related assets happen below this point

    let testJS = this.testJSEntrypoint(appFiles, prepared);
    html.insertScriptTag(html.testJavascript, testJS.relativePath, { type: 'module' });

    let implicitTestScriptsAsset = this.implicitTestScriptsAsset(prepared, parentEngine);
    if (implicitTestScriptsAsset) {
      html.insertScriptTag(html.implicitTestScripts, implicitTestScriptsAsset.relativePath);
    }

    let implicitTestStylesAsset = this.implicitTestStylesAsset(prepared, parentEngine);
    if (implicitTestStylesAsset) {
      html.insertStyleLink(html.implicitTestStyles, implicitTestStylesAsset.relativePath);
    }
  }

  private implicitScriptsAsset(
    prepared: Map<string, InternalAsset>,
    application: Engine,
    emberENV: EmberENV
  ): InternalAsset | undefined {
    let asset = prepared.get('assets/vendor.js');
    if (!asset) {
      let implicitScripts = this.impliedAssets('implicit-scripts', application, emberENV);
      if (implicitScripts.length > 0) {
        asset = new ConcatenatedAsset('assets/vendor.js', implicitScripts, this.resolvableExtensionsPattern);
        prepared.set(asset.relativePath, asset);
      }
    }
    return asset;
  }

  private implicitStylesAsset(prepared: Map<string, InternalAsset>, application: Engine): InternalAsset | undefined {
    let asset = prepared.get('assets/vendor.css');
    if (!asset) {
      let implicitStyles = this.impliedAssets('implicit-styles', application);
      if (implicitStyles.length > 0) {
        // we reverse because we want the synthetic vendor style at the top
        asset = new ConcatenatedAsset('assets/vendor.css', implicitStyles.reverse(), this.resolvableExtensionsPattern);
        prepared.set(asset.relativePath, asset);
      }
    }
    return asset;
  }

  private implicitTestScriptsAsset(
    prepared: Map<string, InternalAsset>,
    application: Engine
  ): InternalAsset | undefined {
    let testSupportJS = prepared.get('assets/test-support.js');
    if (!testSupportJS) {
      let implicitTestScripts = this.impliedAssets('implicit-test-scripts', application);
      if (implicitTestScripts.length > 0) {
        testSupportJS = new ConcatenatedAsset(
          'assets/test-support.js',
          implicitTestScripts,
          this.resolvableExtensionsPattern
        );
        prepared.set(testSupportJS.relativePath, testSupportJS);
      }
    }
    return testSupportJS;
  }

  private implicitTestStylesAsset(
    prepared: Map<string, InternalAsset>,
    application: Engine
  ): InternalAsset | undefined {
    let asset = prepared.get('assets/test-support.css');
    if (!asset) {
      let implicitTestStyles = this.impliedAssets('implicit-test-styles', application);
      if (implicitTestStyles.length > 0) {
        asset = new ConcatenatedAsset('assets/test-support.css', implicitTestStyles, this.resolvableExtensionsPattern);
        prepared.set(asset.relativePath, asset);
      }
    }
    return asset;
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

  @Memoize()
  private get activeFastboot() {
    return this.adapter.activeAddonChildren(this.app).find(a => a.name === 'ember-cli-fastboot');
  }

  @Memoize()
  private get fastbootConfig():
    | { packageJSON: object; extraAppFiles: string[]; extraVendorFiles: string[] }
    | undefined {
    if (this.activeFastboot) {
      // this is relying on work done in stage1 by @embroider/compat/src/compat-adapters/ember-cli-fastboot.ts
      let packageJSON = readJSONSync(join(this.activeFastboot.root, '_fastboot_', 'package.json'));
      let { extraAppFiles, extraVendorFiles } = packageJSON['embroider-fastboot'];
      delete packageJSON['embroider-fastboot'];
      extraVendorFiles.push('assets/embroider_macros_fastboot_init.js');
      return { packageJSON, extraAppFiles, extraVendorFiles };
    }
  }

  private appDiffers: { differ: AppDiffer; engine: EngineSummary }[] | undefined;

  private updateAppJS(inputPaths: OutputPaths<TreeNames>): Engine[] {
    let appJSPath = this.adapter.appJSSrcDir(inputPaths);
    if (!this.appDiffers) {
      let engines = this.partitionEngines(appJSPath);
      this.appDiffers = engines.map(engine => {
        let differ: AppDiffer;
        if (this.activeFastboot) {
          differ = new AppDiffer(
            engine.destPath,
            engine.sourcePath,
            [...engine.addons],
            true,
            this.adapter.fastbootJSSrcDir(inputPaths),
            this.babelParserConfig()
          );
        } else {
          differ = new AppDiffer(engine.destPath, engine.sourcePath, [...engine.addons]);
        }
        return {
          differ,
          engine,
        };
      });
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
        appFiles: new AppFiles(a.differ, this.resolvableExtensionsPattern, this.adapter.podModulePrefix()),
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

    if (this.activeFastboot) {
      const source = `
      (function(){
        var key = '_embroider_macros_runtime_config';
        if (!window[key]){ window[key] = [];}
        window[key].push(function(m) {
          m.setGlobalConfig('fastboot', Object.assign({}, m.getGlobalConfig().fastboot, { isRunning: true }));
        });
      }())`;
      assets.push({
        kind: 'in-memory',
        source,
        relativePath: 'assets/embroider_macros_fastboot_init.js',
      });
    }

    // and finally tack on the ones from our app itself
    return assets.concat(this.adapter.assets(inputPaths));
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    if (this.adapter.env !== 'production') {
      this.macrosConfig.enableAppDevelopment(this.root);
      this.macrosConfig.enableRuntimeMode();
    }
    for (let pkgRoot of this.adapter.developingAddons()) {
      this.macrosConfig.enablePackageDevelopment(pkgRoot);
    }

    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.macrosConfig.finalize();

    let appFiles = this.updateAppJS(inputPaths);
    let emberENV = this.adapter.emberENV();
    let assets = this.gatherAssets(inputPaths);

    let finalAssets = await this.updateAssets(assets, appFiles, emberENV);
    let templateCompiler = this.templateCompiler(emberENV);
    let babelConfig = this.babelConfig(templateCompiler, appFiles);
    let templateCompilerIsParallelSafe = this.addTemplateCompiler(templateCompiler);
    this.addBabelConfig(babelConfig);

    let assetPaths = assets.map(asset => asset.relativePath);

    if (this.activeFastboot) {
      // when using fastboot, our own package.json needs to be in the output so fastboot can read it.
      assetPaths.push('package.json');
    }

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
        isParallelSafe: templateCompilerIsParallelSafe,
      },
      babel: {
        filename: '_babel_config_.js',
        isParallelSafe: babelConfig.isParallelSafe,
        majorVersion: this.adapter.babelMajorVersion(),
        fileFilter: '_babel_filter_.js',
      },
      'resolvable-extensions': this.adapter.adjustImportsOptions().resolvableExtensions,
      'root-url': this.adapter.rootURL(),
    };

    if (!this.adapter.strictV2Format()) {
      meta['auto-upgraded'] = true;
    }

    let pkg = this.combinePackageJSON(meta);
    writeFileSync(join(this.root, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }

  private combinePackageJSON(meta: AppMeta): object {
    let pkgLayers = [this.app.packageJSON, { keywords: ['ember-addon'], 'ember-addon': meta }];
    let fastbootConfig = this.fastbootConfig;
    if (fastbootConfig) {
      pkgLayers.push(fastbootConfig.packageJSON);
    }
    return combinePackageJSON(...pkgLayers);
  }

  private templateCompiler(config: EmberENV): NodeTemplateCompilerParams {
    let plugins = this.adapter.htmlbarsPlugins();
    if (!plugins.ast) {
      plugins.ast = [];
    }
    let { plugins: macroPlugins, setConfig } = MacrosConfig.astPlugins();
    setConfig(this.macrosConfig);
    for (let macroPlugin of macroPlugins) {
      plugins.ast.push(macroPlugin);
    }

    const compilerPath = resolve.sync(this.adapter.templateCompilerPath(), { basedir: this.root });
    const compilerChecksum = getEmberExports(compilerPath).cacheKey;

    return {
      plugins,
      compilerPath,
      compilerChecksum,
      resolver: this.adapter.templateResolver(),
      EmberENV: config,
    };
  }

  @Memoize()
  private get portableHints(): PortableHint[] {
    return this.options.pluginHints.map(hint => {
      let cursor = join(this.app.root, 'package.json');
      for (let i = 0; i < hint.resolve.length; i++) {
        let target = hint.resolve[i];
        if (i < hint.resolve.length - 1) {
          target = join(target, 'package.json');
        }
        cursor = resolve.sync(target, { basedir: dirname(cursor) });
      }

      return {
        requireFile: cursor,
        useMethod: hint.useMethod,
        packageVersion: maybeNodeModuleVersion(cursor),
      };
    });
  }

  private addTemplateCompiler(params: NodeTemplateCompilerParams): boolean {
    let mod = templateCompilerModule(params, this.portableHints);
    writeFileSync(join(this.root, '_template_compiler_.js'), mod.src, 'utf8');
    return mod.isParallelSafe;
  }

  private addBabelConfig(pconfig: { config: TransformOptions; isParallelSafe: boolean }) {
    if (!pconfig.isParallelSafe) {
      warn('Your build is slower because some babel plugins are non-serializable');
    }
    writeFileSync(
      join(this.root, '_babel_config_.js'),
      `module.exports = ${JSON.stringify(pconfig.config, null, 2)}`,
      'utf8'
    );
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

  @Memoize()
  private get staticAppPathsPattern(): RegExp | undefined {
    if (this.options.staticAppPaths.length > 0) {
      return new RegExp(
        '^(?:' +
          this.options.staticAppPaths.map(staticAppPath => escapeRegExp(staticAppPath.replace(/\//g, sep))).join('|') +
          ')(?:$|' +
          sep +
          ')'
      );
    }
  }

  private requiredOtherFiles(appFiles: AppFiles): readonly string[] {
    let pattern = this.staticAppPathsPattern;
    if (pattern) {
      return appFiles.otherAppFiles.filter(f => {
        return !pattern!.test(f);
      });
    } else {
      return appFiles.otherAppFiles;
    }
  }

  private appJSAsset(
    relativePath: string,
    engine: Engine,
    childEngines: Engine[],
    prepared: Map<string, InternalAsset>,
    entryParams?: Partial<Parameters<typeof entryTemplate>[0]>
  ): InternalAsset {
    let { appFiles } = engine;
    let cached = prepared.get(relativePath);
    if (cached) {
      return cached;
    }

    let eagerModules = [];
    if (!this.adapter.adjustImportsOptions().emberNeedsModulesPolyfill) {
      // when we're running with fake ember modules, vendor.js takes care of
      // this bootstrapping. But when we're running with real ember modules,
      // it's up to our entrypoint.
      eagerModules.push('@ember/-internals/bootstrap');
    }

    let requiredAppFiles = [this.requiredOtherFiles(appFiles)];
    if (!this.options.staticComponents) {
      requiredAppFiles.push(appFiles.components);
    }
    if (!this.options.staticHelpers) {
      requiredAppFiles.push(appFiles.helpers);
    }

    let styles = [];
    // only import styles from engines with a parent (this excludeds the parent application) as their styles
    // will be inserted via a direct <link> tag.
    if (engine.parent && engine.package.isLazyEngine()) {
      let implicitStyles = this.impliedAssets('implicit-styles', engine);
      for (let style of implicitStyles) {
        styles.push({
          path: explicitRelative('assets/_engine_', style.relativePath),
        });
      }

      let engineMeta = engine.package.meta as AddonMeta;
      if (engineMeta && engineMeta['implicit-styles']) {
        for (let style of engineMeta['implicit-styles']) {
          styles.push({
            path: explicitRelative(dirname(relativePath), join(engine.appRelativePath, style)),
          });
        }
      }
    }

    let lazyEngines: { names: string[]; path: string }[] = [];
    for (let childEngine of childEngines) {
      let asset = this.appJSAsset(
        `assets/_engine_/${encodeURIComponent(childEngine.package.name)}.js`,
        childEngine,
        [],
        prepared
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

    let [fastboot, nonFastboot] = partition(excludeDotFiles(flatten(requiredAppFiles)), file =>
      appFiles.isFastbootOnly.get(file)
    );
    let amdModules = nonFastboot.map(file => this.importPaths(engine, file, relativePath));
    let fastbootOnlyAmdModules = fastboot.map(file => this.importPaths(engine, file, relativePath));

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', relativePath, engine, amdModules);

    let params = { amdModules, fastbootOnlyAmdModules, lazyRoutes, lazyEngines, eagerModules, styles };
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
    let noHBS = engineRelativePath.replace(this.resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
    return {
      runtime: `${engine.modulePrefix}/${noHBS}`,
      buildtime: explicitRelative(dirname(fromFile), appRelativePath),
    };
  }

  private routeEntrypoint(engine: Engine, relativePath: string, files: string[]) {
    let [fastboot, nonFastboot] = partition(files, file => engine.appFiles.isFastbootOnly.get(file));

    let asset: InternalAsset = {
      kind: 'in-memory',
      source: routeEntryTemplate({
        files: nonFastboot.map(f => this.importPaths(engine, f, relativePath)),
        fastbootOnlyFiles: fastboot.map(f => this.importPaths(engine, f, relativePath)),
      }),
      relativePath,
    };
    return asset;
  }

  private testJSEntrypoint(engines: Engine[], prepared: Map<string, InternalAsset>): InternalAsset {
    let asset = prepared.get(`assets/test.js`);
    if (asset) {
      return asset;
    }

    // We're only building tests from the first engine (the app). This is the
    // normal thing to do -- tests from engines don't automatically roll up into
    // the app.
    let engine = engines[0];

    const myName = 'assets/test.js';

    // tests necessarily also include the app. This is where we account for
    // that. The classic solution was to always include the app's separate
    // script tag in the tests HTML, but that isn't as easy for final stage
    // packagers to understand. It's better to express it here as a direct
    // module dependency.
    let eagerModules: string[] = [
      explicitRelative(dirname(myName), this.topAppJSAsset(engines, prepared).relativePath),
    ];

    if (!this.adapter.adjustImportsOptions().emberNeedsModulesPolyfill) {
      // when we're running with fake ember modules, the prebuilt test-support
      // script takes care of this bootstrapping. But when we're running with
      // real ember modules, it's up to our entrypoint.
      eagerModules.push('ember-testing');
    }

    let amdModules: { runtime: string; buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', myName, engine, amdModules);

    let { appFiles } = engine;
    for (let relativePath of appFiles.tests) {
      amdModules.push(this.importPaths(engine, relativePath, myName));
    }

    let source = entryTemplate({
      amdModules,
      eagerModules,
      testSuffix: true,
    });

    asset = {
      kind: 'in-memory',
      source,
      relativePath: myName,
    };
    prepared.set(asset.relativePath, asset);
    return asset;
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
          let packageName = addon.name;

          if (addon.isV2Addon()) {
            let renamedMeta = addon.meta['renamed-packages'];
            if (renamedMeta) {
              Object.entries(renamedMeta).forEach(([key, value]) => {
                if (value === addon!.name) {
                  packageName = key;
                }
              });
            }
          }

          let runtime = join(packageName, name).replace(this.resolvableExtensionsPattern, '');
          let runtimeRenameLookup = runtime.split('\\').join('/');
          if (renamedModules && renamedModules[runtimeRenameLookup]) {
            runtime = renamedModules[runtimeRenameLookup];
          }
          runtime = runtime.split(sep).join('/');
          lazyModules.push({
            runtime,
            buildtime:
              this.options.implicitModulesStrategy === 'packageNames'
                ? join(packageName, name)
                : explicitRelative(dirname(join(this.root, relativeTo)), join(addon.root, name)),
          });
        }
      }
    }
  }
}

const entryTemplate = compile(`
import { importSync as i, macroCondition, getGlobalConfig } from '@embroider/macros';
let w = window;
let d = w.define;

{{#if styles}}
  if (macroCondition(!getGlobalConfig().fastboot?.isRunning)) {
    {{#each styles as |stylePath| ~}}
      i("{{js-string-escape stylePath.path}}");
    {{/each}}
  }
{{/if}}

{{#each amdModules as |amdModule| ~}}
  d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}

{{#if fastbootOnlyAmdModules}}
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    {{#each fastbootOnlyAmdModules as |amdModule| ~}}
      d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
    {{/each}}
  }
{{/if}}

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
  amdModules: { runtime: string; buildtime: string }[];
  fastbootOnlyAmdModules?: { runtime: string; buildtime: string }[];
  eagerModules?: string[];
  autoRun?: boolean;
  appBoot?: string;
  mainModule?: string;
  appConfig?: unknown;
  testSuffix?: boolean;
  lazyRoutes?: { names: string[]; path: string }[];
  lazyEngines?: { names: string[]; path: string }[];
  styles?: { path: string }[];
}) => string;

const routeEntryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let d = window.define;
{{#each files as |amdModule| ~}}
d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}
{{#if fastbootOnlyFiles}}
  import { macroCondition, getGlobalConfig } from '@embroider/macros';
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    {{#each fastbootOnlyFiles as |amdModule| ~}}
    d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
    {{/each}}
  }
{{/if}}
`) as (params: {
  files: { runtime: string; buildtime: string }[];
  fastbootOnlyFiles: { runtime: string; buildtime: string }[];
}) => string;

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
function inverseRenamedModules(meta: AddonPackage['meta'], extensions: RegExp) {
  let renamed = meta['renamed-modules'];
  if (renamed) {
    let inverted = {} as { [name: string]: string };
    for (let [classic, real] of Object.entries(renamed)) {
      inverted[real.replace(extensions, '')] = classic.replace(extensions, '');
    }
    return inverted;
  }
}

function combinePackageJSON(...layers: object[]) {
  function custom(objValue: any, srcValue: any, key: string, _object: any, _source: any, stack: { size: number }) {
    if (key === 'keywords' && stack.size === 0) {
      if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    }
  }
  return mergeWith({}, ...layers, custom);
}
