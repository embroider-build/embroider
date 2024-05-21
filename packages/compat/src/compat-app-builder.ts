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
} from '@embroider/core';
import { resolve as resolvePath } from 'path';
import { JSDOM } from 'jsdom';
import type Options from './options';
import type { CompatResolverOptions } from './resolver-transform';
import type { PackageRules } from './dependency-rules';
import { activePackageRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import mergeWith from 'lodash/mergeWith';
import cloneDeep from 'lodash/cloneDeep';
import bind from 'bind-decorator';
import {
  outputJSONSync,
  readFileSync,
  readJSONSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  realpathSync,
} from 'fs-extra';
import type { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from './resolver-transform';
import type { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import type { InMemoryAsset, OnDiskAsset } from '@embroider/core/src/asset';
import { makePortable } from '@embroider/core/src/portable-babel-config';
import { AppFiles } from '@embroider/core/src/app-files';
import type { PortableHint } from '@embroider/core/src/portable';
import { maybeNodeModuleVersion } from '@embroider/core/src/portable';
import assertNever from 'assert-never';
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import resolve from 'resolve';
import type ContentForConfig from './content-for-config';
import type { V1Config } from './v1-config';
import type { Package, PackageInfo } from '@embroider/core';
import { ensureDirSync, copySync, readdirSync, pathExistsSync } from 'fs-extra';
import type { TransformOptions } from '@babel/core';
import { MacrosConfig } from '@embroider/macros/src/node';
import escapeRegExp from 'escape-string-regexp';

import type CompatApp from './compat-app';
import { SyncDir } from './sync-dir';

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
    private contentForTree: ContentForConfig,
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
    return ['.wasm', '.mjs', '.js', '.json', '.ts', '.hbs', '.hbs.js', '.gjs', '.gts'];
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
        isLazy: appFiles.engine.package.isLazyEngine(),
      })),
      amdCompatibility: this.options.amdCompatibility,

      // this is the additional stufff that @embroider/compat adds on top to do
      // global template resolving
      modulePrefix: this.modulePrefix(),
      splitAtRoutes: this.options.splitAtRoutes,
      podModulePrefix: this.podModulePrefix(),
      activePackageRules: this.activeRules(),
      options,
      autoRun: this.compatApp.autoRun,
      staticAppPaths: this.options.staticAppPaths,
    };

    return config;
  }

  @Memoize()
  private get resolvableExtensionsPattern(): RegExp {
    return extensionsPattern(this.resolvableExtensions());
  }

  @Memoize()
  private async babelConfig(resolverConfig: CompatResolverOptions) {
    let babel = cloneDeep(this.compatApp.babelConfig());

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));

    // https://github.com/webpack/webpack/issues/12154
    babel.plugins.push(require.resolve('./rename-require-plugin'));

    babel.plugins.push([
      require.resolve('babel-plugin-ember-template-compilation'),
      await this.etcOptions(resolverConfig),
    ]);

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

  private partitionEngines(): Engine[] {
    let queue: Engine[] = [
      {
        package: this.appPackageWithMovedDeps,
        addons: new Map(),
        isApp: true,
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
            isApp: !current,
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

  private updateAppJS(appJSPath: string): AppFiles[] {
    if (!this.engines) {
      this.engines = this.partitionEngines().map(engine => {
        if (engine.isApp) {
          // this is the app. We have more to do for the app than for other
          // engines.
          let fastbootSync: SyncDir | undefined;
          if (this.activeFastboot) {
            let fastbootDir = this.fastbootJSSrcDir();
            if (fastbootDir) {
              fastbootSync = new SyncDir(fastbootDir, resolvePath(this.root, '_fastboot_'));
            }
          }
          return {
            engine,
            appSync: new SyncDir(appJSPath, this.root),
            fastbootSync,
          };
        } else {
          // this is not the app, so it's some other engine. Engines are already
          // built by stage1 like all other addons, so we only need to observe
          // their files, not doing any actual copying or building.
          return {
            engine,
            appSync: new SyncDir(engine.package.root, undefined),

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
          this.staticAppPathsPattern,
          this.podModulePrefix()
        )
    );
  }

  @Memoize()
  private get staticAppPathsPattern(): RegExp | undefined {
    if (this.options.staticAppPaths.length > 0) {
      return new RegExp(
        '^(?:' + this.options.staticAppPaths.map(staticAppPath => escapeRegExp(staticAppPath)).join('|') + ')(?:$|/)'
      );
    }
  }

  private prepareAsset(asset: Asset, prepared: Map<string, InternalAsset>) {
    if (asset.kind === 'ember') {
      prepared.set(asset.relativePath, new BuiltEmberAsset(asset));
    } else {
      prepared.set(asset.relativePath, asset);
    }
  }

  private prepareAssets(requestedAssets: Asset[]): Map<string, InternalAsset> {
    let prepared: Map<string, InternalAsset> = new Map();
    for (let asset of requestedAssets) {
      this.prepareAsset(asset, prepared);
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

  // This function is the one writting the index.html in the rewritten-app
  private updateBuiltEmberAsset(asset: BuiltEmberAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private async updateAssets(requestedAssets: Asset[]): Promise<void> {
    let assets = this.prepareAssets(requestedAssets);
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
  }

  private firstBuild = true;

  async build(inputPaths: OutputPaths<TreeNames>) {
    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.compatApp.macrosConfig.finalize();

    // on first build, clear the output directory completely
    if (this.firstBuild) {
      rmSync(this.root, { recursive: true, force: true });
      this.firstBuild = false;
    }

    let appFiles = this.updateAppJS(inputPaths.appJS);

    let assets: Asset[] = [];
    for (let asset of this.emberEntrypoints(inputPaths.htmlTree)) {
      assets.push(asset);
    }

    await this.updateAssets(assets);

    let assetPaths = assets.map(asset => asset.relativePath);

    if (this.activeFastboot) {
      // when using fastboot, our own package.json needs to be in the output so fastboot can read it.
      assetPaths.push('package.json');
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
    this.addContentForConfig(this.contentForTree.readContents());
    this.addEmberEnvConfig(this.configTree.readConfig().EmberENV);
    this.addAppBoot(this.compatApp.appBoot.readAppBoot());
    let babelConfig = await this.babelConfig(resolverConfig);
    this.addBabelConfig(babelConfig);
    writeFileSync(
      join(this.root, 'macros-config.json'),
      JSON.stringify(this.compatApp.macrosConfig.babelPluginConfig()[0], null, 2)
    );
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

  private async etcOptions(resolverConfig: CompatResolverOptions): Promise<EtcOptions> {
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
    let resolution = await resolver.nodeResolve(
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

  private addContentForConfig(contentForConfig: any) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'content-for.json'), contentForConfig, {
      spaces: 2,
    });
  }

  private addEmberEnvConfig(emberEnvConfig: any) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'ember-env.json'), emberEnvConfig, {
      spaces: 2,
    });
  }

  private addAppBoot(appBoot?: string) {
    writeFileSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'ember-app-boot.js'), appBoot ?? '');
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

interface TreeNames {
  appJS: BroccoliNode;
  htmlTree: BroccoliNode;
  publicTree: BroccoliNode | undefined;
  configTree: BroccoliNode;
}

type InternalAsset = OnDiskAsset | InMemoryAsset | BuiltEmberAsset;

class BuiltEmberAsset {
  kind: 'built-ember' = 'built-ember';
  relativePath: string;
  source: string;

  constructor(asset: EmberAsset) {
    this.source = new JSDOM(readFileSync(asset.sourcePath, 'utf8')).serialize();
    this.relativePath = asset.relativePath;
  }
}
