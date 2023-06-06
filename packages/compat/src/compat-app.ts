import { Node as BroccoliNode } from 'broccoli-node-api';
import {
  PackageCache,
  OutputPaths,
  Asset,
  EmberAsset,
  AddonPackage,
  Engine,
  WaitForTrees,
  AppMeta,
  explicitRelative,
  extensionsPattern,
  TemplateColocationPluginOptions,
  debug,
  warn,
  jsHandlebarsCompile,
  templateColocationPluginPath,
  cacheBustingPluginVersion,
  cacheBustingPluginPath,
  Stage,
} from '@embroider/core';
import walkSync from 'walk-sync';
import { resolve as resolvePath, posix } from 'path';
import { JSDOM } from 'jsdom';
import Options, { optionsWithDefaults } from './options';
import { CompatResolverOptions } from './resolver-transform';
import { activePackageRules, PackageRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import mergeWith from 'lodash/mergeWith';
import cloneDeep from 'lodash/cloneDeep';
import { sync as resolveSync } from 'resolve';
import bind from 'bind-decorator';
import { outputJSONSync, readJSONSync, statSync, unlinkSync, writeFileSync } from 'fs-extra';
import type { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from './resolver-transform';
import type { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import { PreparedEmberHTML } from '@embroider/core/src/ember-html';
import { InMemoryAsset, OnDiskAsset, ImplicitAssetPaths } from '@embroider/core/src/asset';
import { makePortable } from '@embroider/core/src/portable-babel-config';
import { AppFiles, EngineSummary, RouteFiles } from '@embroider/core/src/app-files';
import { mangledEngineRoot } from '@embroider/core/src/engine-mangler';
import { PortableHint, maybeNodeModuleVersion } from '@embroider/core/src/portable';
import AppDiffer from '@embroider/core/src/app-differ';
import assertNever from 'assert-never';
import { Memoize } from 'typescript-memoize';
import { sync as pkgUpSync } from 'pkg-up';
import { join, dirname, isAbsolute, sep } from 'path';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { V1Config, WriteV1Config } from './v1-config';
import { WriteV1AppBoot, ReadV1AppBoot } from './v1-appboot';
import {
  AddonMeta,
  Package,
  EmberAppInstance,
  OutputFileToInputFileMap,
  PackageInfo,
  AddonInstance,
} from '@embroider/core';
import { writeJSONSync, ensureDirSync, copySync, readdirSync, pathExistsSync, existsSync } from 'fs-extra';
import AddToTree from './add-to-tree';
import DummyPackage, { OwningAddon } from './dummy-package';
import { TransformOptions } from '@babel/core';
import { isEmbroiderMacrosPlugin, MacrosConfig } from '@embroider/macros/src/node';
import resolvePackagePath from 'resolve-package-path';
import Concat from 'broccoli-concat';
import mapKeys from 'lodash/mapKeys';
import SynthesizeTemplateOnlyComponents from './synthesize-template-only-components';
import { isEmberAutoImportDynamic, isInlinePrecompilePlugin } from './detect-babel-plugins';
import prepHtmlbarsAstPluginsForUnwrap from './prepare-htmlbars-ast-plugins';
import { readFileSync } from 'fs';
import type { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import semver from 'semver';
import { MovablePackageCache } from './moved-package-cache';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import SourceMapConcat from 'fast-sourcemap-concat';
import escapeRegExp from 'escape-string-regexp';

type EmberCliHTMLBarsAddon = AddonInstance & {
  htmlbarsOptions(): HTMLBarsOptions;
};

interface Group {
  outputFiles: OutputFileToInputFileMap;
  implicitKey: '_implicitStyles' | '_implicitScripts';
  vendorOutputPath: 'string';
}

interface TreeNames {
  appJS: BroccoliNode;
  htmlTree: BroccoliNode;
  publicTree: BroccoliNode | undefined;
  configTree: BroccoliNode;
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

type EmberENV = unknown;

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

class CompatAppBuilder {
  // for each relativePath, an Asset we have already emitted
  private assets: Map<string, InternalAsset> = new Map();

  constructor(
    private root: string,
    private appPackage: Package,
    private options: Required<Options>,
    private compatApp: CompatApp,
    private configTree: V1Config,
    private synthVendor: Package,
    private synthStyles: Package
  ) {}

  @Memoize()
  private fastbootJSSrcDir() {
    let target = join(this.root, 'fastboot');
    if (pathExistsSync(target)) {
      return target;
    }
  }

  private extractAssets(treePaths: OutputPaths<TreeNames>): Asset[] {
    let assets: Asset[] = [];

    // Everything in our traditional public tree is an on-disk asset
    if (treePaths.publicTree) {
      walkSync
        .entries(treePaths.publicTree, {
          directories: false,
        })
        .forEach(entry => {
          assets.push({
            kind: 'on-disk',
            relativePath: entry.relativePath,
            sourcePath: entry.fullPath,
            mtime: entry.mtime as unknown as number, // https://github.com/joliss/node-walk-sync/pull/38
            size: entry.size,
          });
        });
    }

    // ember-cli traditionally outputs a dummy testem.js file to prevent
    // spurious errors when running tests under "ember s".
    if (this.compatApp.shouldBuildTests) {
      let testemAsset = this.findTestemAsset();
      if (testemAsset) {
        assets.push(testemAsset);
      }
    }

    for (let asset of this.emberEntrypoints(treePaths.htmlTree)) {
      assets.push(asset);
    }

    return assets;
  }

  @Memoize()
  private findTestemAsset(): Asset | undefined {
    let sourcePath;
    try {
      sourcePath = resolveSync('ember-cli/lib/broccoli/testem.js', { basedir: this.root });
    } catch (err) {}
    if (sourcePath) {
      let stat = statSync(sourcePath);
      return {
        kind: 'on-disk',
        relativePath: 'testem.js',
        sourcePath,
        mtime: stat.mtime.getTime(),
        size: stat.size,
      };
    }
  }

  private activeAddonChildren(pkg: Package = this.appPackage): AddonPackage[] {
    let result = (pkg.dependencies.filter(this.isActiveAddon) as AddonPackage[]).filter(
      // When looking for child addons, we want to ignore 'peerDependencies' of
      // a given package, to align with how ember-cli resolves addons. So here
      // we only include dependencies that definitely appear in one of the other
      // sections.
      addon => pkg.packageJSON.dependencies?.[addon.name] || pkg.packageJSON.devDependencies?.[addon.name]
    );
    if (pkg === this.appPackage) {
      let extras = [this.synthVendor, this.synthStyles].filter(this.isActiveAddon) as AddonPackage[];
      result = [...result, ...extras];
    }
    return result.sort(this.orderAddons);
  }

  @Memoize()
  private get allActiveAddons(): AddonPackage[] {
    let result = this.appPackage.findDescendants(this.isActiveAddon) as AddonPackage[];
    let extras = [this.synthVendor, this.synthStyles].filter(this.isActiveAddon) as AddonPackage[];
    let extraDescendants = flatMap(extras, dep => dep.findDescendants(this.isActiveAddon)) as AddonPackage[];
    result = [...result, ...extras, ...extraDescendants];
    return result.sort(this.orderAddons);
  }

  @bind
  private isActiveAddon(pkg: Package): boolean {
    // todo: filter by addon-provided hook
    return pkg.isEmberPackage();
  }

  @bind
  private orderAddons(depA: Package, depB: Package): number {
    let depAIdx = 0;
    let depBIdx = 0;

    if (depA && depA.meta && depA.isV2Addon()) {
      depAIdx = depA.meta['order-index'] || 0;
    }
    if (depB && depB.meta && depB.isV2Addon()) {
      depBIdx = depB.meta['order-index'] || 0;
    }

    return depAIdx - depBIdx;
  }

  private resolvableExtensions(): string[] {
    // webpack's default is ['.wasm', '.mjs', '.js', '.json']. Keeping that
    // subset in that order is sensible, since many third-party libraries will
    // expect it to work that way.
    //
    // For TS, we defer to ember-cli-babel, and the setting for
    // "enableTypescriptTransform" can be set with and without
    // ember-cli-typescript
    return ['.wasm', '.mjs', '.js', '.json', '.ts', '.hbs', '.hbs.js'];
  }

  private *emberEntrypoints(htmlTreePath: string): IterableIterator<Asset> {
    let classicEntrypoints = [
      { entrypoint: 'index.html', includeTests: false },
      { entrypoint: 'tests/index.html', includeTests: true },
    ];
    if (!this.compatApp.shouldBuildTests) {
      classicEntrypoints.pop();
    }
    for (let { entrypoint, includeTests } of classicEntrypoints) {
      let sourcePath = join(htmlTreePath, entrypoint);
      let stats = statSync(sourcePath);
      let asset: EmberAsset = {
        kind: 'ember',
        relativePath: entrypoint,
        includeTests,
        sourcePath,
        mtime: stats.mtime.getTime(),
        size: stats.size,
        rootURL: this.rootURL(),
        prepare: (dom: JSDOM) => {
          let scripts = [...dom.window.document.querySelectorAll('script')];
          let styles = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];

          return {
            javascript: definitelyReplace(dom, this.compatApp.findAppScript(scripts, entrypoint)),
            styles: definitelyReplace(dom, this.compatApp.findAppStyles(styles, entrypoint)),
            implicitScripts: definitelyReplace(dom, this.compatApp.findVendorScript(scripts, entrypoint)),
            implicitStyles: definitelyReplace(dom, this.compatApp.findVendorStyles(styles, entrypoint)),
            testJavascript: maybeReplace(dom, this.compatApp.findTestScript(scripts)),
            implicitTestScripts: maybeReplace(dom, this.compatApp.findTestSupportScript(scripts)),
            implicitTestStyles: maybeReplace(dom, this.compatApp.findTestSupportStyles(styles)),
          };
        },
      };
      yield asset;
    }
  }

  private modulePrefix(): string {
    return this.configTree.readConfig().modulePrefix;
  }

  private podModulePrefix(): string | undefined {
    return this.configTree.readConfig().podModulePrefix;
  }

  private rootURL(): string {
    return this.configTree.readConfig().rootURL;
  }

  private templateCompilerPath(): string {
    return 'ember-source/vendor/ember/ember-template-compiler';
  }

  @Memoize()
  private activeRules() {
    return activePackageRules(this.options.packageRules.concat(defaultAddonPackageRules()), [
      { name: this.appPackage.name, version: this.appPackage.version, root: this.root },
      ...this.allActiveAddons.filter(p => p.meta['auto-upgraded']),
    ]);
  }

  private resolverConfig(engines: Engine[]): CompatResolverOptions {
    let renamePackages = Object.assign({}, ...this.allActiveAddons.map(dep => dep.meta['renamed-packages']));
    let renameModules = Object.assign({}, ...this.allActiveAddons.map(dep => dep.meta['renamed-modules']));

    let activeAddons: CompatResolverOptions['activeAddons'] = {};
    for (let addon of this.allActiveAddons) {
      activeAddons[addon.name] = addon.root;
    }

    let config: CompatResolverOptions = {
      // this part is the base ModuleResolverOptions as required by @embroider/core
      activeAddons,
      renameModules,
      renamePackages,
      resolvableExtensions: this.resolvableExtensions(),
      appRoot: this.root,
      engines: engines.map((engine, index) => ({
        packageName: engine.package.name,
        root: index === 0 ? this.root : engine.package.root, // first engine is the app, which has been relocated to this.roto
        activeAddons: [...engine.addons]
          .map(a => ({
            name: a.name,
            root: a.root,
          }))
          // the traditional order is the order in which addons will run, such
          // that the last one wins. Our resolver's order is the order to
          // search, so first one wins.
          .reverse(),
      })),

      // this is the additional stufff that @embroider/compat adds on top to do
      // global template resolving
      modulePrefix: this.modulePrefix(),
      podModulePrefix: this.podModulePrefix(),
      options: this.options,
      activePackageRules: this.activeRules(),
    };

    return config;
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
    return extensionsPattern(this.resolvableExtensions());
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
        source: `window.EmberENV={ ...(window.EmberENV || {}), ...${JSON.stringify(emberENV, null, 2)} };`,
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
    let babel = cloneDeep(this.compatApp.babelConfig());

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));
    return babel;
  }

  @Memoize()
  private babelConfig(resolverConfig: CompatResolverOptions) {
    let babel = cloneDeep(this.compatApp.babelConfig());

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));

    // https://github.com/webpack/webpack/issues/12154
    babel.plugins.push(require.resolve('./rename-require-plugin'));

    babel.plugins.push([require.resolve('babel-plugin-ember-template-compilation'), this.etcOptions(resolverConfig)]);

    // this is @embroider/macros configured for full stage3 resolution
    babel.plugins.push(...this.compatApp.macrosConfig.babelPluginConfig());

    let colocationOptions: TemplateColocationPluginOptions = {
      appRoot: this.root,

      // This extra weirdness is a compromise in favor of build performance.
      //
      // 1. When auto-upgrading an addon from v1 to v2, we definitely want to
      //    run any custom AST transforms in stage1.
      //
      // 2. In general case, AST transforms are allowed to manipulate Javascript
      //    scope. This means that running transforms -- even when we're doing
      //    source-to-source compilation that emits handlebars and not wire
      //    format -- implies changing .hbs files into .js files.
      //
      // 3. So stage1 may need to rewrite .hbs to .hbs.js (to avoid colliding
      //    with an existing co-located .js file).
      //
      // 4. But stage1 doesn't necessarily want to run babel over the
      //    corresponding JS file. Most of the time, that's just an
      //    unnecessarily expensive second parse. (We only run it in stage1 to
      //    eliminate an addon's custom babel plugins, and many addons don't
      //    have any.)
      //
      // 5. Therefore, the work of template-colocation gets defered until here,
      //    and it may see co-located templates named `.hbs.js` instead of the
      //    usual `.hbs.
      templateExtensions: ['.hbs', '.hbs.js'],

      // All of the above only applies to auto-upgraded packages that were
      // authored in v1. V2 packages don't get any of this complexity, they're
      // supposed to take care of colocating their own templates explicitly.
      packageGuard: true,
    };
    babel.plugins.push([templateColocationPluginPath, colocationOptions]);

    babel.plugins.push([
      require.resolve('./babel-plugin-adjust-imports'),
      (() => {
        let pluginConfig: AdjustImportsOptions = {
          appRoot: resolverConfig.appRoot,
        };
        return pluginConfig;
      })(),
    ]);

    // we can use globally shared babel runtime by default
    babel.plugins.push([
      require.resolve('@babel/plugin-transform-runtime'),
      { absoluteRuntime: __dirname, useESModules: true, regenerator: false },
    ]);

    const portable = makePortable(babel, { basedir: this.root }, this.portableHints);
    addCachablePlugin(portable.config);
    return portable;
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

    html.insertStyleLink(html.styles, `assets/${this.appPackage.name}.css`);

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
  private findActiveAddons(pkg: Package, engine: EngineSummary, isChild = false): void {
    for (let child of this.activeAddonChildren(pkg)) {
      if (!child.isEngine()) {
        this.findActiveAddons(child, engine, true);
      }
      engine.addons.add(child);
    }
    // ensure addons are applied in the correct order, if set (via @embroider/compat/v1-addon)
    if (!isChild) {
      engine.addons = new Set(
        [...engine.addons].sort((a, b) => {
          return (a.meta['order-index'] || 0) - (b.meta['order-index'] || 0);
        })
      );
    }
  }

  private partitionEngines(appJSPath: string): EngineSummary[] {
    let queue: EngineSummary[] = [
      {
        package: this.appPackage,
        addons: new Set(),
        parent: undefined,
        sourcePath: appJSPath,
        destPath: this.root,
        modulePrefix: this.modulePrefix(),
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
    return this.activeAddonChildren(this.appPackage).find(a => a.name === 'ember-cli-fastboot');
  }

  @Memoize()
  private get fastbootConfig():
    | { packageJSON: PackageInfo; extraAppFiles: string[]; extraVendorFiles: string[] }
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
    let appJSPath = inputPaths.appJS;
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
            this.fastbootJSSrcDir(),
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
      return {
        ...a.engine,
        appFiles: new AppFiles(a.differ, this.resolvableExtensionsPattern, this.podModulePrefix()),
      };
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
      let MeasureConcat = (await import('@embroider/core/src/measure-concat')).default;
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
    for (let pkg of this.allActiveAddons) {
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
    return assets.concat(this.extractAssets(inputPaths));
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.compatApp.macrosConfig.finalize();

    let appFiles = this.updateAppJS(inputPaths);
    let emberENV = this.configTree.readConfig().EmberENV;
    let assets = this.gatherAssets(inputPaths);

    let finalAssets = await this.updateAssets(assets, appFiles, emberENV);

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
      babel: {
        filename: '_babel_config_.js',
        isParallelSafe: true, // TODO
        majorVersion: this.compatApp.babelMajorVersion(),
        fileFilter: '_babel_filter_.js',
      },
      'root-url': this.rootURL(),
    };

    // all compat apps are auto-upgraded, there's no v2 app format here
    meta['auto-upgraded'] = true;

    let pkg = this.combinePackageJSON(meta);
    writeFileSync(join(this.root, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

    let resolverConfig = this.resolverConfig(appFiles);
    this.addResolverConfig(resolverConfig);
    let babelConfig = this.babelConfig(resolverConfig);
    this.addBabelConfig(babelConfig);
  }

  private combinePackageJSON(meta: AppMeta): object {
    let pkgLayers: any[] = [this.appPackage.packageJSON];
    let fastbootConfig = this.fastbootConfig;
    if (fastbootConfig) {
      // fastboot-specific package.json output is allowed to add to our original package.json
      pkgLayers.push(fastbootConfig.packageJSON);
    }
    // but our own new v2 app metadata takes precedence over both
    pkgLayers.push({ keywords: ['ember-addon'], 'ember-addon': meta });
    return combinePackageJSON(...pkgLayers);
  }

  private etcOptions(resolverConfig: CompatResolverOptions): EtcOptions {
    let transforms = this.compatApp.htmlbarsPlugins;

    let { plugins: macroPlugins, setConfig } = MacrosConfig.transforms();
    setConfig(this.compatApp.macrosConfig);
    for (let macroPlugin of macroPlugins) {
      transforms.push(macroPlugin as any);
    }

    if (
      this.options.staticComponents ||
      this.options.staticHelpers ||
      this.options.staticModifiers ||
      (globalThis as any).embroider_audit
    ) {
      let opts: ResolverTransformOptions = {
        appRoot: resolverConfig.appRoot,
      };
      transforms.push([require.resolve('./resolver-transform'), opts]);
    }

    return {
      transforms,
      compilerPath: resolve.sync(this.templateCompilerPath(), { basedir: this.root }),
      enableLegacyModules: ['ember-cli-htmlbars', 'ember-cli-htmlbars-inline-precompile', 'htmlbars-inline-precompile'],
    };
  }

  @Memoize()
  private get portableHints(): PortableHint[] {
    return this.options.pluginHints.map(hint => {
      let cursor = join(this.appPackage.root, 'package.json');
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
      babelFilterTemplate({ skipBabel: this.options.skipBabel, appRoot: this.root }),
      'utf8'
    );
  }

  private addResolverConfig(config: CompatResolverOptions) {
    outputJSONSync(join(this.root, '.embroider', 'resolver.json'), config);
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
    let relativePath = `assets/${this.appPackage.name}.js`;
    return this.appJSAsset(relativePath, app, childEngines, prepared, {
      autoRun: this.compatApp.autoRun,
      appBoot: !this.compatApp.autoRun ? this.compatApp.appBoot.readAppBoot() : '',
      mainModule: explicitRelative(dirname(relativePath), 'app'),
      appConfig: this.configTree.readConfig().APP,
    });
  }

  @Memoize()
  private get staticAppPathsPattern(): RegExp | undefined {
    if (this.options.staticAppPaths.length > 0) {
      return new RegExp(
        '^(?:' + this.options.staticAppPaths.map(staticAppPath => escapeRegExp(staticAppPath)).join('|') + ')(?:$|/)'
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

    let requiredAppFiles = [this.requiredOtherFiles(appFiles)];
    if (!this.options.staticComponents) {
      requiredAppFiles.push(appFiles.components);
    }
    if (!this.options.staticHelpers) {
      requiredAppFiles.push(appFiles.helpers);
    }
    if (!this.options.staticModifiers) {
      requiredAppFiles.push(appFiles.modifiers);
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
            path: this.importPaths(engine, routeEntrypoint).buildtime,
          });
        }
      );
    }

    let [fastboot, nonFastboot] = partition(excludeDotFiles(flatten(requiredAppFiles)), file =>
      appFiles.isFastbootOnly.get(file)
    );
    let amdModules = nonFastboot.map(file => this.importPaths(engine, file));
    let fastbootOnlyAmdModules = fastboot.map(file => this.importPaths(engine, file));

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', engine, amdModules);

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

  private importPaths(engine: Engine, engineRelativePath: string) {
    let noHBS = engineRelativePath.replace(this.resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
    return {
      runtime: `${engine.modulePrefix}/${noHBS}`,
      buildtime: posix.join(engine.package.name, engineRelativePath),
    };
  }

  private routeEntrypoint(engine: Engine, relativePath: string, files: string[]) {
    let [fastboot, nonFastboot] = partition(files, file => engine.appFiles.isFastbootOnly.get(file));

    let asset: InternalAsset = {
      kind: 'in-memory',
      source: routeEntryTemplate({
        files: nonFastboot.map(f => this.importPaths(engine, f)),
        fastbootOnlyFiles: fastboot.map(f => this.importPaths(engine, f)),
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

    let amdModules: { runtime: string; buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', engine, amdModules);

    let { appFiles } = engine;
    for (let relativePath of appFiles.tests) {
      amdModules.push(this.importPaths(engine, relativePath));
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
            buildtime: posix.join(packageName, name),
          });
        }
      }
    }
  }
}

// This runs at broccoli-pipeline-construction time, whereas our actual
// CompatAppBuilder instance only becomes available during tree-building time.
export default class CompatApp {
  private annotation = '@embroider/compat/app';
  private active: CompatAppBuilder | undefined;
  private outputPath: string | undefined;
  private packageCache: PackageCache | undefined;
  readonly options: Required<Options>;

  private _publicAssets: { [filePath: string]: string } = Object.create(null);
  private _implicitScripts: string[] = [];
  private _implicitStyles: string[] = [];

  movablePackageCache: MovablePackageCache;

  private get isDummy(): boolean {
    return this.legacyEmberAppInstance.project.pkg.keywords?.includes('ember-addon') ?? false;
  }

  private get name(): string {
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

  get autoRun(): boolean {
    return this.legacyEmberAppInstance.options.autoRun;
  }

  @Memoize()
  get appBoot(): ReadV1AppBoot {
    let env = this.legacyEmberAppInstance.env;
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
      patterns: this.configReplacePatterns,
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
      patterns: this.configReplacePatterns,
      annotation: 'ConfigReplace/testIndexTree',
    });
  }

  @Memoize()
  babelConfig(): TransformOptions {
    // this finds all the built-in babel configuration that comes with ember-cli-babel
    const babelAddon = (this.legacyEmberAppInstance.project as any).findAddonByName('ember-cli-babel');
    const babelConfig = babelAddon.buildBabelOptions({
      'ember-cli-babel': {
        ...this.legacyEmberAppInstance.options['ember-cli-babel'],
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
    let appBabel = this.legacyEmberAppInstance.options.babel;
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
        for (let file of readdirSync(assetPath)) {
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
    let addon = this.legacyEmberAppInstance.project.addons.find(
      (a: AddonInstance) => a.name === 'ember-cli-htmlbars'
    ) as unknown as EmberCliHTMLBarsAddon;
    let options = addon.htmlbarsOptions();
    if (options?.plugins?.ast) {
      // even if the app was using @embroider/macros, we drop it from the config
      // here in favor of our globally-configured one.
      options.plugins.ast = options.plugins.ast.filter((p: any) => !isEmbroiderMacrosPlugin(p));
      prepHtmlbarsAstPluginsForUnwrap(this.legacyEmberAppInstance.registry);

      // classically, this list was backwards for silly historic reasons. But
      // we're the compatibility system, so we're putting it back into
      // reasonable order.
      options.plugins.ast.reverse();

      return options.plugins.ast;
    } else {
      return [];
    }
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
    let config = new WriteV1Config(this.config, this.storeConfigInMeta);
    let patterns = this.configReplacePatterns;
    let configReplaced = new this.configReplace(config, this.configTree, {
      configPath: join('environments', `${this.legacyEmberAppInstance.env}.json`),
      files: ['config/environment.js'],
      patterns,
    });

    let trees: BroccoliNode[] = [];
    trees.push(appTree);
    trees.push(
      new SynthesizeTemplateOnlyComponents(appTree, { allowedPaths: ['components'], templateExtensions: ['.hbs'] })
    );

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
    if ((src.startsWith(rootURL) && rootURL) || (!rootURL && !src.startsWith('/'))) {
      src = '/' + src.slice(rootURL.length);
    } else if (src.startsWith('/' + rootURL)) {
      src = src.slice(rootURL.length);
    }
    return src;
  }

  findAppScript(scripts: HTMLScriptElement[], entrypoint: string): HTMLScriptElement {
    let appJS = scripts.find(
      script => this.withoutRootURL(script.src) === this.legacyEmberAppInstance.options.outputPaths.app.js
    );
    return throwIfMissing(
      appJS,
      this.legacyEmberAppInstance.options.outputPaths.app.js,
      scripts.map(s => s.src),
      entrypoint,
      'app javascript'
    );
  }

  findAppStyles(styles: HTMLLinkElement[], entrypoint: string): HTMLLinkElement {
    let style = styles.find(
      style => this.withoutRootURL(style.href) === this.legacyEmberAppInstance.options.outputPaths.app.css.app
    );
    return throwIfMissing(
      style,
      this.legacyEmberAppInstance.options.outputPaths.app.css.app,
      styles.map(s => s.href),
      entrypoint,
      'app css'
    );
  }

  findVendorScript(scripts: HTMLScriptElement[], entrypoint: string): HTMLScriptElement {
    let vendor = scripts.find(
      script => this.withoutRootURL(script.src) === this.legacyEmberAppInstance.options.outputPaths.vendor.js
    );
    return throwIfMissing(
      vendor,
      this.legacyEmberAppInstance.options.outputPaths.vendor.js,
      scripts.map(s => s.src),
      entrypoint,
      'vendor javascript'
    );
  }

  findVendorStyles(styles: HTMLLinkElement[], entrypoint: string): HTMLLinkElement {
    let vendorStyle = styles.find(
      style => this.withoutRootURL(style.href) === this.legacyEmberAppInstance.options.outputPaths.vendor.css
    );
    return throwIfMissing(
      vendorStyle,
      this.legacyEmberAppInstance.options.outputPaths.vendor.css,
      styles.map(s => s.href),
      entrypoint,
      'vendor css'
    );
  }

  findTestSupportStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(
      style => this.withoutRootURL(style.href) === this.legacyEmberAppInstance.options.outputPaths.testSupport.css
    );
  }

  findTestSupportScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(
      script =>
        this.withoutRootURL(script.src) === this.legacyEmberAppInstance.options.outputPaths.testSupport.js.testSupport
    );
  }

  findTestScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(
      script => this.withoutRootURL(script.src) === this.legacyEmberAppInstance.options.outputPaths.tests.js
    );
  }

  readonly macrosConfig: MacrosConfig;

  constructor(readonly legacyEmberAppInstance: EmberAppInstance, _options?: Options) {
    this.options = optionsWithDefaults(_options);

    this.macrosConfig = MacrosConfig.for(legacyEmberAppInstance, this.root);
    if (this.env !== 'production') {
      this.macrosConfig.enablePackageDevelopment(this.root);
      this.macrosConfig.enableRuntimeMode();
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

    this.movablePackageCache = new MovablePackageCache(this.macrosConfig, this.root);

    if (this.isDummy) {
      let owningAddon = new OwningAddon(legacyEmberAppInstance.project.root, this.movablePackageCache);
      this.movablePackageCache.seed(owningAddon);
      this.movablePackageCache.seed(new DummyPackage(this.root, owningAddon, this.movablePackageCache));
      this.macrosConfig.enablePackageDevelopment(owningAddon.root);
    }
  }

  private inTrees(prevStageTree: BroccoliNode) {
    let publicTree = this.publicTree;
    let configTree = this.config;

    if (this.options.extraPublicTrees.length > 0) {
      publicTree = mergeTrees([publicTree, ...this.options.extraPublicTrees].filter(Boolean) as BroccoliNode[]);
    }

    return {
      appJS: this.processAppJS().appJS,
      htmlTree: this.htmlTree,
      publicTree,
      configTree,
      appBootTree: this.appBoot,
      prevStageTree,
    };
  }

  private async instantiate(root: string, appSrcDir: string, packageCache: PackageCache, configTree: V1Config) {
    return new CompatAppBuilder(
      root,
      packageCache.get(appSrcDir),
      this.options,
      this,
      configTree,
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-vendor')),
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-styles'))
    );
  }

  asStage(prevStage: Stage): Stage {
    let tree = () => {
      let inTrees = this.inTrees(prevStage.tree);
      return new WaitForTrees(inTrees, this.annotation, async treePaths => {
        if (!this.active) {
          let { outputPath, packageCache } = await prevStage.ready();
          this.outputPath = outputPath;
          this.packageCache = packageCache;
          this.active = await this.instantiate(outputPath, prevStage.inputPath, packageCache, inTrees.configTree);
        }
        await this.active.build(treePaths);
        this.deferReady.resolve();
      });
    };

    return {
      get inputPath() {
        return prevStage.inputPath;
      },
      ready: async () => {
        await this.deferReady.promise;
        return {
          outputPath: this.outputPath!,
          packageCache: this.packageCache!,
        };
      },
      get tree() {
        return tree();
      },
    };
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => (resolve = r));
    return { resolve: resolve!, promise };
  }
}

function maybeReplace(dom: JSDOM, element: Element | undefined): Node | undefined {
  if (element) {
    return definitelyReplace(dom, element);
  }
}

function definitelyReplace(dom: JSDOM, element: Element): Node {
  let placeholder = dom.window.document.createTextNode('');
  element.replaceWith(placeholder);
  return placeholder;
}

function defaultAddonPackageRules(): PackageRules[] {
  return readdirSync(join(__dirname, 'addon-dependency-rules'))
    .map(filename => {
      if (filename.endsWith('.js')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(join(__dirname, 'addon-dependency-rules', filename)).default;
      }
    })
    .filter(Boolean)
    .reduce((a, b) => a.concat(b), []);
}

const entryTemplate = jsHandlebarsCompile(`
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

const routeEntryTemplate = jsHandlebarsCompile(`
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

const babelFilterTemplate = jsHandlebarsCompile(`
const { babelFilter } = require(${JSON.stringify(require.resolve('@embroider/core'))});
module.exports = babelFilter({{{json-stringify skipBabel}}}, "{{{js-string-escape appRoot}}}");
`) as (params: { skipBabel: Options['skipBabel']; appRoot: string }) => string;

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

function addCachablePlugin(babelConfig: TransformOptions) {
  if (Array.isArray(babelConfig.plugins) && babelConfig.plugins.length > 0) {
    const plugins = Object.create(null);
    plugins[cacheBustingPluginPath] = cacheBustingPluginVersion;

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
      cacheBustingPluginPath,
      {
        plugins,
      },
    ]);
  }
}

function excludeDotFiles(files: string[]) {
  return files.filter(file => !file.startsWith('.') && !file.includes('/.'));
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

interface Preprocessors {
  preprocessJs(tree: BroccoliNode, a: string, b: string, options: object): BroccoliNode;
  preprocessCss(tree: BroccoliNode, a: string, b: string, options: object): BroccoliNode;
}
