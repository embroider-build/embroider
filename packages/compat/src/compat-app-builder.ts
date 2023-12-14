import type { Node as BroccoliNode } from 'broccoli-node-api';
import type {
  OutputPaths,
  Asset,
  EmberAsset,
  AddonPackage,
  Engine,
  AppMeta,
  TemplateColocationPluginOptions,
} from '@embroider/core';
import {
  explicitRelative,
  extensionsPattern,
  debug,
  warn,
  jsHandlebarsCompile,
  templateColocationPluginPath,
  cacheBustingPluginVersion,
  cacheBustingPluginPath,
  Resolver,
  locateEmbroiderWorkingDir,
  RewrittenPackageCache,
} from '@embroider/core';
import walkSync from 'walk-sync';
import { resolve as resolvePath, posix } from 'path';
import type { JSDOM } from 'jsdom';
import type Options from './options';
import type { CompatResolverOptions } from './resolver-transform';
import type { PackageRules } from './dependency-rules';
import { activePackageRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import mergeWith from 'lodash/mergeWith';
import cloneDeep from 'lodash/cloneDeep';
import { sync as resolveSync } from 'resolve';
import bind from 'bind-decorator';
import { outputJSONSync, readJSONSync, rmSync, statSync, unlinkSync, writeFileSync, realpathSync } from 'fs-extra';
import type { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from './resolver-transform';
import type { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import type { InMemoryAsset, OnDiskAsset, ImplicitAssetPaths } from '@embroider/core/src/asset';
import { ConcatenatedAsset, ParsedEmberAsset, BuiltEmberAsset } from '@embroider/core/src/asset';
import { makePortable } from '@embroider/core/src/portable-babel-config';
import type { RouteFiles } from '@embroider/core/src/app-files';
import { AppFiles } from '@embroider/core/src/app-files';
import type { PortableHint } from '@embroider/core/src/portable';
import { maybeNodeModuleVersion } from '@embroider/core/src/portable';
import assertNever from 'assert-never';
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import resolve from 'resolve';
import type { V1Config } from './v1-config';
import type { AddonMeta, Package, PackageInfo } from '@embroider/core';
import { ensureDirSync, copySync, readdirSync, pathExistsSync } from 'fs-extra';
import type { TransformOptions } from '@babel/core';
import { MacrosConfig } from '@embroider/macros/src/node';
import SourceMapConcat from 'fast-sourcemap-concat';
import escapeRegExp from 'escape-string-regexp';
import { configReplacePatterns } from 'ember-cli/lib/utilities/ember-app-utils';

import type CompatApp from './compat-app';
import { SyncDir } from './sync-dir';
import glob from 'fast-glob';
import { readFileSync } from 'fs';
import MeasureConcat from '@embroider/core/src/measure-concat';
import * as process from 'process';

// This exists during the actual broccoli build step. As opposed to CompatApp,
// which also exists during pipeline-construction time.

export class CompatAppBuilder {
  // for each relativePath, an Asset we have already emitted
  private assets: Map<string, InternalAsset> = new Map();

  constructor(
    private root: string,
    private origAppPackage: Package,
    private appPackageWithMovedDeps: Package,
    private options: Required<Options>,
    private compatApp: CompatApp,
    private configTree: V1Config,
    private synthVendor: Package,
    private synthStyles: Package
  ) {}

  @Memoize()
  private fastbootJSSrcDir() {
    let target = join(this.compatApp.root, 'fastboot');
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

    if (treePaths.htmlTree) {
      for (let asset of this.emberEntrypoints(treePaths.htmlTree)) {
        assets.push(asset);
      }
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

  private activeAddonChildren(pkg: Package): AddonPackage[] {
    let result = (pkg.dependencies.filter(this.isActiveAddon) as AddonPackage[]).filter(
      // When looking for child addons, we want to ignore 'peerDependencies' of
      // a given package, to align with how ember-cli resolves addons. So here
      // we only include dependencies that are definitely active due to one of
      // the other sections.
      addon => pkg.categorizeDependency(addon.name) !== 'peerDependencies'
    );
    if (pkg === this.appPackageWithMovedDeps) {
      let extras = [this.synthVendor, this.synthStyles].filter(this.isActiveAddon) as AddonPackage[];
      result = [...result, ...extras];
    }
    return result.sort(this.orderAddons);
  }

  @Memoize()
  private get allActiveAddons(): AddonPackage[] {
    let result = this.appPackageWithMovedDeps.findDescendants(this.isActiveAddon) as AddonPackage[];
    let extras = [this.synthVendor, this.synthStyles].filter(this.isActiveAddon) as AddonPackage[];
    let extraDescendants = flatMap(extras, dep => dep.findDescendants(this.isActiveAddon)) as AddonPackage[];
    result = [...result, ...extras, ...extraDescendants];
    return result.sort(this.orderAddons);
  }

  @bind
  private isActiveAddon(pkg: Package): boolean {
    // stage1 already took care of converting everything that's actually active
    // into v2 addons. If it's not a v2 addon, we don't want it.
    //
    // We can encounter v1 addons here when there is inactive stuff floating
    // around in the node_modules that accidentally satisfy something like an
    // optional peer dep.
    return pkg.isV2Addon();
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
          let styles = [...dom.window.document.querySelectorAll('link[rel*="stylesheet"]')] as HTMLLinkElement[];
          return {
            javascript: this.compatApp.findAppScript(scripts, entrypoint),
            styles: this.compatApp.findAppStyles(styles, entrypoint),
            implicitScripts: this.compatApp.findVendorScript(scripts, entrypoint),
            implicitStyles: this.compatApp.findVendorStyles(styles, entrypoint),
            testJavascript: this.compatApp.findTestScript(scripts),
            implicitTestScripts: this.compatApp.findTestSupportScript(scripts),
            implicitTestStyles: this.compatApp.findTestSupportStyles(styles),
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

  @Memoize()
  private activeRules() {
    return activePackageRules(this.options.packageRules.concat(defaultAddonPackageRules()), [
      { name: this.origAppPackage.name, version: this.origAppPackage.version, root: this.root },
      ...this.allActiveAddons.filter(p => p.meta['auto-upgraded']),
    ]);
  }

  private resolverConfig(engines: AppFiles[]): CompatResolverOptions {
    let renamePackages = Object.assign({}, ...this.allActiveAddons.map(dep => dep.meta['renamed-packages']));
    let renameModules = Object.assign({}, ...this.allActiveAddons.map(dep => dep.meta['renamed-modules']));

    let options: CompatResolverOptions['options'] = {
      staticHelpers: this.options.staticHelpers,
      staticModifiers: this.options.staticModifiers,
      staticComponents: this.options.staticComponents,
      allowUnsafeDynamicComponents: this.options.allowUnsafeDynamicComponents,
    };

    let config: CompatResolverOptions = {
      // this part is the base ModuleResolverOptions as required by @embroider/core
      renameModules,
      renamePackages,
      resolvableExtensions: this.resolvableExtensions(),
      appRoot: this.origAppPackage.root,
      engines: engines.map((appFiles, index) => ({
        packageName: appFiles.engine.package.name,
        // first engine is the app, which has been relocated to this.root
        // we need to use the real path here because webpack requests always use the real path i.e. follow symlinks
        root: realpathSync(index === 0 ? this.root : appFiles.engine.package.root),
        fastbootFiles: appFiles.fastbootFiles,
        activeAddons: [...appFiles.engine.addons]
          .map(([addon, canResolveFromFile]) => ({
            name: addon.name,
            root: addon.root,
            canResolveFromFile,
          }))
          // the traditional order is the order in which addons will run, such
          // that the last one wins. Our resolver's order is the order to
          // search, so first one wins.
          .reverse(),
      })),
      amdCompatibility: this.options.amdCompatibility,

      // this is the additional stufff that @embroider/compat adds on top to do
      // global template resolving
      modulePrefix: this.modulePrefix(),
      podModulePrefix: this.podModulePrefix(),
      activePackageRules: this.activeRules(),
      options,
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
    engine: AppFiles,
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

  private impliedAddonAssets(type: keyof ImplicitAssetPaths, { engine }: AppFiles): string[] {
    let result: Array<string> = [];
    for (let addon of sortBy(Array.from(engine.addons.keys()), this.scriptPriority.bind(this))) {
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
      appRoot: this.origAppPackage.root,

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

  private insertEmberApp(asset: ParsedEmberAsset, appFiles: AppFiles[], prepared: Map<string, InternalAsset>) {
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

    html.insertStyleLink(html.styles, `assets/${this.origAppPackage.name}.css`);

    const parentEngine = appFiles.find(e => !e.engine.parent)!;
    let vendorJS = this.implicitScriptsAsset(prepared, parentEngine);
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

  private implicitScriptsAsset(prepared: Map<string, InternalAsset>, application: AppFiles): InternalAsset | undefined {
    let asset = prepared.get('assets/vendor.js');
    if (!asset) {
      let implicitScripts = this.impliedAssets('implicit-scripts', application);
      if (implicitScripts.length > 0) {
        asset = new ConcatenatedAsset('assets/vendor.js', implicitScripts, this.resolvableExtensionsPattern);
        prepared.set(asset.relativePath, asset);
      }
    }
    return asset;
  }

  private implicitStylesAsset(prepared: Map<string, InternalAsset>, application: AppFiles): InternalAsset | undefined {
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
    application: AppFiles
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
    application: AppFiles
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
  private findActiveAddons(pkg: Package, engine: Engine, isChild = false): void {
    for (let child of this.activeAddonChildren(pkg)) {
      if (!child.isEngine()) {
        this.findActiveAddons(child, engine, true);
      }
      let canResolveFrom: string;
      if (pkg === this.appPackageWithMovedDeps) {
        // we want canResolveFrom to always be a rewritten package path, and our
        // app's package is not rewritten yet here.
        canResolveFrom = resolvePath(this.root, 'package.json');
      } else {
        // whereas our addons are already moved
        canResolveFrom = resolvePath(pkg.root, 'package.json');
      }
      engine.addons.set(child, canResolveFrom);
    }
    // ensure addons are applied in the correct order, if set (via @embroider/compat/v1-addon)
    if (!isChild) {
      engine.addons = new Map(
        [...engine.addons].sort(([a], [b]) => {
          return (a.meta['order-index'] || 0) - (b.meta['order-index'] || 0);
        })
      );
    }
  }

  private partitionEngines(appJSPath: string): Engine[] {
    let queue: Engine[] = [
      {
        package: this.appPackageWithMovedDeps,
        addons: new Map(),
        parent: undefined,
        sourcePath: appJSPath,
        modulePrefix: this.modulePrefix(),
        appRelativePath: '.',
      },
    ];
    let done: Engine[] = [];
    let seenEngines: Set<Package> = new Set();
    while (true) {
      let current = queue.shift();
      if (!current) {
        break;
      }
      this.findActiveAddons(current.package, current);
      for (let addon of current.addons.keys()) {
        if (addon.isEngine() && !seenEngines.has(addon)) {
          seenEngines.add(addon);
          queue.push({
            package: addon,
            addons: new Map(),
            parent: current,
            sourcePath: addon.root,
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
    return this.activeAddonChildren(this.appPackageWithMovedDeps).find(a => a.name === 'ember-cli-fastboot');
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

  private engines: { engine: Engine; appSync: SyncDir; fastbootSync: SyncDir | undefined }[] | undefined;

  private updateAppJS(appJSPath: string, root: string | null = this.root): AppFiles[] {
    if (!this.engines) {
      this.engines = this.partitionEngines(appJSPath).map(engine => {
        if (engine.sourcePath === appJSPath) {
          // this is the app. We have more to do for the app than for other
          // engines.
          let fastbootSync: SyncDir | undefined;
          if (this.activeFastboot) {
            let fastbootDir = this.fastbootJSSrcDir();
            if (fastbootDir) {
              fastbootSync = new SyncDir(fastbootDir, (root && resolvePath(root, '_fastboot_')) || undefined);
            }
          }
          return {
            engine,
            appSync: new SyncDir(appJSPath, root || undefined),
            fastbootSync,
          };
        } else {
          // this is not the app, so it's some other engine. Engines are already
          // built by stage1 like all other addons, so we only need to observe
          // their files, not doing any actual copying or building.
          return {
            engine,
            appSync: new SyncDir(engine.sourcePath, undefined),

            // AFAIK, we've never supported a fastboot overlay directory in an
            // engine. But if we do need that, it would go here.
            fastbootSync: undefined,
          };
        }
      });
    }

    for (let engine of this.engines) {
      engine.appSync.update();
      engine.fastbootSync?.update();
    }

    return this.engines.map(
      ({ engine, appSync, fastbootSync }) =>
        new AppFiles(
          engine,
          appSync.files,
          fastbootSync?.files ?? new Set(),
          this.resolvableExtensionsPattern,
          this.podModulePrefix()
        )
    );
  }

  private prepareAsset(asset: Asset, appFiles: AppFiles[], prepared: Map<string, InternalAsset>) {
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
      this.insertEmberApp(parsed, appFiles, prepared);
      prepared.set(asset.relativePath, new BuiltEmberAsset(parsed));
    } else {
      prepared.set(asset.relativePath, asset);
    }
  }

  private prepareAssets(requestedAssets: Asset[], appFiles: AppFiles[]): Map<string, InternalAsset> {
    let prepared: Map<string, InternalAsset> = new Map();
    for (let asset of requestedAssets) {
      this.prepareAsset(asset, appFiles, prepared);
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

  private updateOnDiskAsset(dst: string, asset: OnDiskAsset) {
    let destination = join(dst, asset.relativePath);
    ensureDirSync(dirname(destination));
    copySync(asset.sourcePath, destination, { dereference: true });
  }

  private updateBuiltEmberAsset(asset: BuiltEmberAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private updateConcatenatedAsset(dst: string, asset: ConcatenatedAsset) {
    let concat = new SourceMapConcat({
      mapURL: join(dst, asset.relativePath),
      file: join(dst, asset.relativePath),
      mapCommentType: asset.relativePath.endsWith('.js') ? 'line' : 'block',
      baseDir: dst,
    });
    if (process.env.EMBROIDER_CONCAT_STATS) {
      concat = new MeasureConcat(asset.relativePath, concat, dst);
    }
    for (let source of asset.sources) {
      switch (source.kind) {
        case 'on-disk':
          concat.addFile(explicitRelative(dst, source.sourcePath));
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
    // since we are using in-memory streams, its synchronous
    void concat.end();
    asset.code = concat.stream.toString();
    const sourceMapComment =
      '\n' +
      '/*# sourceMappingURL=data:application/json;base64,' +
      Buffer.from(JSON.stringify(concat.content)).toString('base64') +
      '*/';
    asset.code += sourceMapComment;
  }

  private updateAssets(requestedAssets: Asset[], appFiles: AppFiles[], noWrite?: boolean, dst: string = this.root) {
    let assets = this.prepareAssets(requestedAssets, appFiles);
    for (let asset of assets.values()) {
      if (noWrite || this.assetIsValid(asset, this.assets.get(asset.relativePath))) {
        continue;
      }
      debug('rebuilding %s', asset.relativePath);
      switch (asset.kind) {
        case 'on-disk':
          this.updateOnDiskAsset(dst, asset);
          break;
        case 'in-memory':
          break;
        case 'built-ember':
          // need to write index.html until we completely use the original app folder instead of rewritten app
          if (asset.relativePath.endsWith('index.html')) {
            this.updateBuiltEmberAsset(asset);
          }
          break;
        case 'concatenated-asset':
          this.updateConcatenatedAsset(dst, asset);
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

  private firstBuild = true;

  buildCachedAssets(environment: 'production' | 'development') {
    let appFiles = this.updateAppJS(this.root, null);
    let assets = this.gatherAssets({
      htmlTree: this.root,
      publicTree: 'public',
    } as any);

    assets.forEach(asset => {
      if (asset.relativePath.endsWith('index.html')) {
        let env = environment as 'production' | 'development' | 'test';
        if (asset.relativePath.endsWith('tests/index.html')) {
          env = 'test';
        }
        const html = this.prepareHtml(asset.relativePath, env);
        (asset as EmberAsset).source = html;
      }
    });

    return this.updateAssets(assets, appFiles);
  }

  build(inputPaths: OutputPaths<TreeNames>) {
    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.compatApp.macrosConfig.finalize();

    // on first build, clear the output directory completely
    if (this.firstBuild) {
      rmSync(this.root, { recursive: true, force: true });
      this.firstBuild = false;
    }

    let appFiles = this.updateAppJS(inputPaths.appJS);
    let assets = this.gatherAssets(inputPaths);

    let finalAssets = this.updateAssets(assets, appFiles);

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
    this.addLegacyAppInfo();
    this.addAssetInfo(finalAssets, inputPaths);
    let babelConfig = this.babelConfig(resolverConfig);
    this.addBabelConfig(babelConfig);
    writeFileSync(
      join(this.root, 'macros-config.json'),
      JSON.stringify(this.compatApp.macrosConfig.babelPluginConfig()[0], null, 2)
    );
  }

  prepareHtml(htmlPath: string, env: string) {
    const workingDir = locateEmbroiderWorkingDir(process.cwd());
    const legacyApp = readJSONSync(join(workingDir, 'legacy-app-info.json'));
    const configPath = require.resolve(join(process.cwd(), 'config', 'environment.js'));
    // it would also be possible to process.fork(['-c', 'require(configPath)(env)'])
    delete require.cache[require.resolve(configPath)];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const buildAppEnv = require(configPath);
    let html = readFileSync(join(process.cwd(), htmlPath)).toString();
    legacyApp.configReplacePatterns[env].forEach((pattern: any) => {
      html = html.replace(new RegExp(pattern.match, 'g'), pattern.replacement);
    });

    function merge(source: any, target: any) {
      for (const [key, val] of Object.entries(source)) {
        if (val !== null && typeof val === `object`) {
          target[key] ??= new (val as any).__proto__.constructor();
          merge(val, target[key]);
        } else {
          target[key] = val;
        }
      }
      return target; // we're replacing in-situ, so this is more for chaining than anything else
    }

    const emberENV = legacyApp.environments[env];
    const newestEnv = buildAppEnv(env);
    merge(newestEnv, emberENV);
    emberENV.APP = newestEnv.APP;

    html = html.replace(
      new RegExp(
        `<meta\\s+name=["']${legacyApp.project.pkg.name}/config/environment["']\\s+content=["'](.*)["']\\s+/>`
      ),
      (match, content) => {
        return match.replace(content, encodeURIComponent(JSON.stringify(emberENV)));
      }
    );
    return html;
  }

  rebuildHtml(root: string, environment: 'production' | 'development', appOrTestHtml: 'app' | 'test') {
    const file = appOrTestHtml === 'app' ? 'index.html' : 'tests/index.html';
    const env = appOrTestHtml === 'test' ? 'test' : environment === 'production' ? 'production' : 'development';
    const html = this.prepareHtml(file, env);

    const assets: Asset[] = [];
    for (let asset of this.emberEntrypoints(this.root)) {
      if (asset.relativePath === file) {
        (asset as EmberAsset).source = html;
        assets.push(asset);
      }
    }

    const engines = this.partitionEngines(root);
    const appFiles = engines.map((engine: Engine) => {
      return new AppFiles(
        engine,
        new Set(),
        new Set(),
        extensionsPattern(this.resolvableExtensions()),
        this.podModulePrefix()
      );
    });

    const internalAssets = this.updateAssets(assets, appFiles, true);
    const indexFile = internalAssets.find(a => (a as any).relativePath === file)!;
    return (indexFile as BuiltEmberAsset).source;
  }

  rebuildEntryFile(root: string) {
    const engines = this.partitionEngines(root);
    const rewrittenPackageCache = RewrittenPackageCache.shared('embroider', this.root);
    const pkg = rewrittenPackageCache.get(this.root);
    const relativePath = root.endsWith('/tests') ? 'assets/test.js' : `assets/${pkg.name}.js`;

    const appFiles = engines.map((engine: Engine) => {
      const isTest = engine.sourcePath.endsWith('/tests');
      let files = glob.sync(`**/*{${this.resolvableExtensions().join(',')}}`, {
        cwd: engine.sourcePath,
      }) as string[];
      if (isTest) {
        files = files.map(f => `tests/${f}`);
      }
      files.push('config/environment.js');
      return new AppFiles(
        engine,
        new Set(files),
        new Set(),
        extensionsPattern(this.resolvableExtensions()),
        this.podModulePrefix()
      );
    });
    const assets: Asset[] = [];
    for (let asset of this.emberEntrypoints('.')) {
      (asset as EmberAsset).source = this.prepareHtml(asset.relativePath, 'development');
      assets.push(asset);
    }
    const internalAssets = this.updateAssets(assets, appFiles, true);
    const indexFile = internalAssets.find(a => (a as any).relativePath === relativePath)!;
    return (indexFile as BuiltEmberAsset).source;
  }

  async copyPublicAssetsToDir(dir: string) {
    const assets = this.gatherAssets({
      publicTree: 'public',
    } as any);
    this.updateAssets(assets, [], false, dir);
  }

  private combinePackageJSON(meta: AppMeta): object {
    let pkgLayers: any[] = [this.origAppPackage.packageJSON];
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

    let resolver = new Resolver(resolverConfig);
    let resolution = resolver.nodeResolve(
      'ember-source/vendor/ember/ember-template-compiler',
      resolvePath(this.root, 'package.json')
    );
    if (resolution.type !== 'real') {
      throw new Error(`bug: unable to resolve ember-template-compiler from ${this.root}`);
    }

    return {
      transforms,
      compilerPath: resolution.filename,
      enableLegacyModules: ['ember-cli-htmlbars', 'ember-cli-htmlbars-inline-precompile', 'htmlbars-inline-precompile'],
    };
  }

  @Memoize()
  private get portableHints(): PortableHint[] {
    return this.options.pluginHints.map(hint => {
      let cursor = join(this.origAppPackage.root, 'package.json');
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
      babelFilterTemplate({ skipBabel: this.options.skipBabel, appRoot: this.origAppPackage.root }),
      'utf8'
    );
  }

  private addResolverConfig(config: CompatResolverOptions) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'resolver.json'), config, { spaces: 2 });
  }

  private addAssetInfo(finalAssets: InternalAsset[], inputPaths: OutputPaths<TreeNames>) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'asset-info.json'), {
      assets: finalAssets.map(a => ({
        kind: a.kind,
        relativePath: a.relativePath,
        sourcePath: (a as OnDiskAsset).sourcePath,
      })),
      inputPaths: inputPaths,
    });
  }

  private addLegacyAppInfo() {
    const project = this.compatApp.legacyEmberAppInstance.project as any;
    const production = project.config('production');
    const development = project.config('development');
    const test = project.config('test');
    const options = {
      ...this.compatApp.legacyEmberAppInstance.options,
      addons: this.compatApp.legacyEmberAppInstance.project.addons,
    };
    const patterns = configReplacePatterns(options);
    function replacements(env: any) {
      const contentFor = [
        'head',
        'head-footer',
        'body',
        'body-footer',
        'test-head',
        'test-head-footer',
        'test-body',
        'test-body-footer',
      ];
      const match: Record<string, string> = {
        '{{rootURL}}': /{{\s?rootURL\s?}}/g.source,
      };
      contentFor.forEach(c => {
        match[`{{content-for "${c}"}}`] = /{{content-for ['"]xxx["']}}/g.source.replace('xxx', c);
      });
      return ['{{rootURL}}', ...contentFor.map(c => `{{content-for "${c}"}}`)].map(str => {
        const pattern = patterns.find(p => p.match.test(str))!;
        return {
          match: match[str],
          replacement: str.replace(pattern.match, pattern.replacement.bind(null, env)),
        };
      });
    }
    outputJSONSync(
      join(locateEmbroiderWorkingDir(this.compatApp.root), 'legacy-app-info.json'),
      {
        options: {
          outputPaths: this.compatApp.legacyEmberAppInstance.options.outputPaths,
          autoRun: this.compatApp.legacyEmberAppInstance.options.autoRun,
          storeConfigInMeta: this.compatApp.legacyEmberAppInstance.options.storeConfigInMeta,
          minifyCSS: this.compatApp.legacyEmberAppInstance.options.minifyCSS,
        },
        project: {
          root: this.compatApp.legacyEmberAppInstance.project.root,
          pkg: this.compatApp.legacyEmberAppInstance.project.pkg,
        },
        tests: true,
        environments: {
          production,
          development,
          test,
        },
        configReplacePatterns: {
          production: replacements(production),
          development: replacements(development),
          test: replacements(test),
        },
      },
      { spaces: 2 }
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

  private topAppJSAsset(engines: AppFiles[], prepared: Map<string, InternalAsset>): InternalAsset {
    let [app, ...childEngines] = engines;
    let relativePath = `assets/${this.origAppPackage.name}.js`;
    return this.appJSAsset(relativePath, app, childEngines, prepared, {
      autoRun: this.compatApp.autoRun,
      appBoot: !this.compatApp.autoRun ? this.compatApp.appBoot.readAppBoot() : '',
      mainModule: `${this.compatApp.name}/app`,
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
    appFiles: AppFiles,
    childEngines: AppFiles[],
    prepared: Map<string, InternalAsset>,
    entryParams?: Partial<Parameters<typeof entryTemplate>[0]>
  ): InternalAsset {
    let cached = prepared.get(relativePath);
    if (cached) {
      return cached;
    }

    let eagerModules: string[] = [];

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
    if (appFiles.engine.parent && appFiles.engine.package.isLazyEngine()) {
      let implicitStyles = this.impliedAssets('implicit-styles', appFiles);
      for (let style of implicitStyles) {
        styles.push({
          path: explicitRelative('assets/_engine_', style.relativePath),
        });
      }

      let engineMeta = appFiles.engine.package.meta as AddonMeta;
      if (engineMeta && engineMeta['implicit-styles']) {
        for (let style of engineMeta['implicit-styles']) {
          styles.push({
            path: explicitRelative(dirname(relativePath), join(appFiles.engine.appRelativePath, style)),
          });
        }
      }
    }

    let lazyEngines: { names: string[]; path: string }[] = [];
    for (let childEngine of childEngines) {
      let asset = this.appJSAsset(
        `assets/_engine_/${encodeURIComponent(childEngine.engine.package.name)}.js`,
        childEngine,
        [],
        prepared
      );
      if (childEngine.engine.package.isLazyEngine()) {
        lazyEngines.push({
          names: [childEngine.engine.package.name],
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
            prepared.set(routeEntrypoint, this.routeEntrypoint(appFiles, routeEntrypoint, files));
          }
          lazyRoutes.push({
            names: routeNames,
            path: this.importPaths(appFiles, routeEntrypoint).buildtime,
          });
        }
      );
    }

    let [fastboot, nonFastboot] = partition(excludeDotFiles(flatten(requiredAppFiles)), file =>
      appFiles.isFastbootOnly.get(file)
    );
    let amdModules = nonFastboot.map(file => this.importPaths(appFiles, file));
    let fastbootOnlyAmdModules = fastboot.map(file => this.importPaths(appFiles, file));

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    eagerModules.push('./-embroider-implicit-modules.js');

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

  private importPaths({ engine }: AppFiles, engineRelativePath: string) {
    let noHBS = engineRelativePath.replace(this.resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
    return {
      runtime: `${engine.modulePrefix}/${noHBS}`,
      buildtime: posix.join(engine.package.name, engineRelativePath),
    };
  }

  private routeEntrypoint(appFiles: AppFiles, relativePath: string, files: string[]) {
    let [fastboot, nonFastboot] = partition(files, file => appFiles.isFastbootOnly.get(file));

    let asset: InternalAsset = {
      kind: 'in-memory',
      source: routeEntryTemplate({
        files: nonFastboot.map(f => this.importPaths(appFiles, f)),
        fastbootOnlyFiles: fastboot.map(f => this.importPaths(appFiles, f)),
      }),
      relativePath,
    };
    return asset;
  }

  private testJSEntrypoint(appFiles: AppFiles[], prepared: Map<string, InternalAsset>): InternalAsset {
    let asset = prepared.get(`assets/test.js`);
    if (asset) {
      return asset;
    }

    // We're only building tests from the first engine (the app). This is the
    // normal thing to do -- tests from engines don't automatically roll up into
    // the app.
    let engine = appFiles[0];

    const myName = 'assets/test.js';

    // tests necessarily also include the app. This is where we account for
    // that. The classic solution was to always include the app's separate
    // script tag in the tests HTML, but that isn't as easy for final stage
    // packagers to understand. It's better to express it here as a direct
    // module dependency.
    let eagerModules: string[] = ['ember-testing', '/' + this.topAppJSAsset(appFiles, prepared).relativePath];

    let amdModules: { runtime: string; buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    eagerModules.push('./-embroider-implicit-test-modules.js');

    for (let relativePath of engine.tests) {
      amdModules.push(this.importPaths(engine, relativePath));
    }

    let source = entryTemplate({
      mainModule: `${this.compatApp.name}/tests/test-helper`,
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

{{#each eagerModules as |eagerModule| ~}}
  i("{{js-string-escape eagerModule}}");
{{/each}}

{{#each amdModules as |amdModule| ~}}
  d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}

{{#if fastbootOnlyAmdModules}}
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    let fastbootModules = {};

    {{#each fastbootOnlyAmdModules as |amdModule| ~}}
      fastbootModules["{{js-string-escape amdModule.runtime}}"] = import("{{js-string-escape amdModule.buildtime}}");
    {{/each}}

    const resolvedValues = await Promise.all(Object.values(fastbootModules));

    Object.keys(fastbootModules).forEach((k, i) => {
      d(k, function(){ return resolvedValues[i];});
    })
  }
{{/if}}


{{#if lazyRoutes}}
w._embroiderRouteBundles_ = [
  {{#each lazyRoutes as |route|}}
  {
    names: {{json-stringify route.names}},
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
    names: {{json-stringify engine.names}},
    load: function() {
      return import("{{js-string-escape engine.path}}");
    }
  },
  {{/each}}
]
{{/if}}

{{#if autoRun ~}}
if (!runningTests) {
  i("{{js-string-escape mainModule}}").default.create({{json-stringify appConfig}});
}
{{else  if appBoot ~}}
  {{ appBoot }}
{{/if}}

{{#if testSuffix ~}}
  {{!- TODO: both of these suffixes should get dynamically generated so they incorporate
       any content-for added by addons. -}}


  {{!- this is the traditional tests-suffix.js -}}
  i("{{js-string-escape mainModule}}")
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
module.exports = babelFilter({{json-stringify skipBabel}}, "{{js-string-escape appRoot}}");
`) as (params: { skipBabel: Options['skipBabel']; appRoot: string }) => string;

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

interface TreeNames {
  appJS: BroccoliNode;
  htmlTree: BroccoliNode;
  publicTree: BroccoliNode | undefined;
  configTree: BroccoliNode;
}

type EmberENV = unknown;

type InternalAsset = OnDiskAsset | InMemoryAsset | BuiltEmberAsset | ConcatenatedAsset;
