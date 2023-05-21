import { Node as BroccoliNode } from 'broccoli-node-api';
import mergeTrees from 'broccoli-merge-trees';
import {
  Stage,
  OutputPaths,
  BuildStage,
  Asset,
  EmberAsset,
  AppAdapter,
  AppBuilder,
  EmberENV,
  Package,
  AddonPackage,
  Engine,
  RewrittenPackageCache,
} from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import { V1Config } from './v1-config';
import { statSync, readdirSync } from 'fs';
import Options, { optionsWithDefaults } from './options';
import { CompatResolverOptions } from './resolver-transform';
import { activePackageRules, PackageRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import { Memoize } from 'typescript-memoize';
import { sync as resolveSync } from 'resolve';
import { MacrosConfig } from '@embroider/macros/src/node';
import bind from 'bind-decorator';
import { pathExistsSync } from 'fs-extra';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from './resolver-transform';
import type { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import type { PluginItem } from '@babel/core';

interface TreeNames {
  appJS: BroccoliNode;
  htmlTree: BroccoliNode;
  publicTree: BroccoliNode | undefined;
  configTree: BroccoliNode;
}

// This runs at broccoli-pipeline-construction time, whereas our actual
// CompatAppAdapter instance only becomes available during tree-building
// time.
function setup(legacyEmberAppInstance: object, options: Required<Options>) {
  let oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance, options).app;

  let { appJS } = oldPackage.processAppJS();
  let htmlTree = oldPackage.htmlTree;
  let publicTree = oldPackage.publicTree;
  let configTree = oldPackage.config;
  let appBootTree = oldPackage.appBoot;

  if (options.extraPublicTrees.length > 0) {
    publicTree = mergeTrees([publicTree, ...options.extraPublicTrees].filter(Boolean) as BroccoliNode[]);
  }

  let inTrees = {
    appJS,
    htmlTree,
    publicTree,
    configTree,
    appBootTree,
  };

  let instantiate = async (root: string, appSrcDir: string) => {
    let packageCache = RewrittenPackageCache.shared('embroider', appSrcDir);
    let appPackage = packageCache.get(appSrcDir);
    let adapter = new CompatAppAdapter(
      root,
      appPackage,
      options,
      oldPackage,
      configTree,
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-vendor')),
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-styles'))
    );

    return new AppBuilder<TreeNames>(
      root,
      appPackage,
      adapter,
      options,
      MacrosConfig.for(legacyEmberAppInstance, appSrcDir)
    );
  };

  return { inTrees, instantiate };
}

class CompatAppAdapter implements AppAdapter<TreeNames, CompatResolverOptions> {
  constructor(
    private root: string,
    private appPackage: Package,
    private options: Required<Options>,
    private oldPackage: V1App,
    private configTree: V1Config,
    private synthVendor: Package,
    private synthStyles: Package
  ) {}

  appJSSrcDir(treePaths: OutputPaths<TreeNames>) {
    return treePaths.appJS;
  }

  @Memoize()
  fastbootJSSrcDir(_treePaths: OutputPaths<TreeNames>) {
    let target = join(this.oldPackage.root, 'fastboot');
    if (pathExistsSync(target)) {
      return target;
    }
  }

  get env() {
    return this.oldPackage.env;
  }

  assets(treePaths: OutputPaths<TreeNames>): Asset[] {
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
    if (this.oldPackage.shouldBuildTests) {
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
  findTestemAsset(): Asset | undefined {
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

  developingAddons(): string[] {
    if (this.oldPackage.owningAddon) {
      return [this.oldPackage.owningAddon.root];
    }
    return [];
  }

  @Memoize()
  activeAddonChildren(pkg: Package = this.appPackage): AddonPackage[] {
    let deps = this.appSpecialDependencies(pkg);
    let result = (deps.filter(this.isActiveAddon) as AddonPackage[]).filter(
      // When looking for child addons, we want to ignore 'peerDependencies' of
      // a given package, to align with how ember-cli resolves addons. So here
      // we only include dependencies that definitely appear in one of the other
      // sections.
      addon =>
        pkg.packageJSON.dependencies?.[addon.name] ||
        (pkg === this.appPackage && pkg.packageJSON.devDependencies?.[addon.name])
    );
    if (pkg === this.appPackage) {
      let extras = [this.synthVendor, this.synthStyles].filter(this.isActiveAddon) as AddonPackage[];
      result = [...result, ...extras];
    }
    return result.sort(this.orderAddons);
  }

  private appSpecialDependencies(pkg: Package): Package[] {
    if (pkg !== this.appPackage) {
      return pkg.dependencies;
    }
    // the app package is special because at this stage we're still looking at
    // the original app package, but its deps have been rewritten.
    return pkg.dependencies.map(dep => RewrittenPackageCache.shared('embroider', this.appPackage.root).maybeMoved(dep));
  }

  private appSpecialDescendants(pkg: Package, filter?: (p: Package) => boolean) {
    if (pkg !== this.appPackage) {
      return pkg.findDescendants(filter);
    }
    // the app package is special because at this stage we're still looking at
    // the original app package, but its deps have been rewritten.
    return Package.prototype.findDescendants.call({ dependencies: this.appSpecialDependencies(pkg) }, filter);
  }

  @Memoize()
  get allActiveAddons(): AddonPackage[] {
    let result = this.appSpecialDescendants(this.appPackage, this.isActiveAddon) as AddonPackage[];
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

  @Memoize()
  resolvableExtensions(): string[] {
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
    if (!this.oldPackage.shouldBuildTests) {
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
            javascript: definitelyReplace(dom, this.oldPackage.findAppScript(scripts, entrypoint)),
            styles: definitelyReplace(dom, this.oldPackage.findAppStyles(styles, entrypoint)),
            implicitScripts: definitelyReplace(dom, this.oldPackage.findVendorScript(scripts, entrypoint)),
            implicitStyles: definitelyReplace(dom, this.oldPackage.findVendorStyles(styles, entrypoint)),
            testJavascript: maybeReplace(dom, this.oldPackage.findTestScript(scripts)),
            implicitTestScripts: maybeReplace(dom, this.oldPackage.findTestSupportScript(scripts)),
            implicitTestStyles: maybeReplace(dom, this.oldPackage.findTestSupportStyles(styles)),
          };
        },
      };
      yield asset;
    }
  }

  autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  appBoot(): string | undefined {
    return this.oldPackage.appBoot.readAppBoot();
  }

  mainModule(): string {
    return 'app';
  }

  mainModuleConfig(): unknown {
    return this.configTree.readConfig().APP;
  }

  emberENV(): EmberENV {
    return this.configTree.readConfig().EmberENV;
  }

  modulePrefix(): string {
    return this.configTree.readConfig().modulePrefix;
  }

  podModulePrefix(): string | undefined {
    return this.configTree.readConfig().podModulePrefix;
  }

  rootURL(): string {
    return this.configTree.readConfig().rootURL;
  }

  templateCompilerPath(): string {
    return 'ember-source/vendor/ember/ember-template-compiler';
  }

  strictV2Format() {
    return false;
  }

  @Memoize()
  private activeRules() {
    return activePackageRules(this.options.packageRules.concat(defaultAddonPackageRules()), [
      { name: this.appPackage.name, version: this.appPackage.version, root: this.root },
      ...this.allActiveAddons.filter(p => p.meta['auto-upgraded']),
    ]);
  }

  hbsTransforms(resolverConfig: CompatResolverOptions): Transform[] {
    if (
      this.options.staticComponents ||
      this.options.staticHelpers ||
      this.options.staticModifiers ||
      (globalThis as any).embroider_audit
    ) {
      let opts: ResolverTransformOptions = {
        appRoot: resolverConfig.appRoot,
      };
      return [[require.resolve('./resolver-transform'), opts]];
    } else {
      return [];
    }
  }

  jsPlugins(resolverConfig: CompatResolverOptions): PluginItem[] {
    let pluginConfig: AdjustImportsOptions = {
      appRoot: resolverConfig.appRoot,
    };
    return [[require.resolve('./babel-plugin-adjust-imports'), pluginConfig]];
  }

  resolverConfig(engines: Engine[]): CompatResolverOptions {
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

  htmlbarsPlugins(): Transform[] {
    return this.oldPackage.htmlbarsPlugins;
  }

  babelMajorVersion() {
    return this.oldPackage.babelMajorVersion();
  }

  babelConfig() {
    return this.oldPackage.babelConfig();
  }
}

export default class CompatApp extends BuildStage<TreeNames> {
  constructor(legacyEmberAppInstance: object, addons: Stage, options?: Options) {
    let { inTrees, instantiate } = setup(legacyEmberAppInstance, optionsWithDefaults(options));
    super(addons, inTrees, '@embroider/compat/app', instantiate);
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
