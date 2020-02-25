import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import {
  Stage,
  PackageCache,
  OutputPaths,
  BuildStage,
  Asset,
  EmberAsset,
  AppAdapter,
  AppBuilder,
  EmberENV,
  Package,
  TemplateCompilerPlugins,
  Resolver,
  TemplateCompiler,
  AddonPackage,
} from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import { V1Config } from './v1-config';
import { statSync, readdirSync } from 'fs';
import Options, { optionsWithDefaults } from './options';
import CompatResolver from './resolver';
import { activePackageRules, PackageRules, expandModuleRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import { Memoize } from 'typescript-memoize';
import flatten from 'lodash/flatten';
import { sync as resolveSync } from 'resolve';
import { MacrosConfig } from '@embroider/macros';
import { pathExistsSync } from 'fs-extra';

interface TreeNames {
  appJS: Tree;
  htmlTree: Tree;
  publicTree: Tree;
  configTree: Tree;
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
    publicTree = mergeTrees([publicTree, ...options.extraPublicTrees].filter(Boolean));
  }

  let inTrees = {
    appJS,
    htmlTree,
    publicTree,
    configTree,
    appBootTree,
  };

  let instantiate = async (root: string, appSrcDir: string, packageCache: PackageCache) => {
    let appPackage = packageCache.getApp(appSrcDir);
    let adapter = new CompatAppAdapter(
      root,
      appPackage,
      options,
      oldPackage,
      configTree,
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-vendor')),
      packageCache.get(join(root, 'node_modules', '@embroider', 'synthesized-styles'))
    );

    return new AppBuilder<TreeNames>(root, appPackage, adapter, options, MacrosConfig.for(legacyEmberAppInstance));
  };

  return { inTrees, instantiate };
}

class CompatAppAdapter implements AppAdapter<TreeNames> {
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
    let target = join(this.root, 'fastboot');
    if (pathExistsSync(target)) {
      return target;
    }
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
            mtime: (entry.mtime as unknown) as number, // https://github.com/joliss/node-walk-sync/pull/38
            size: entry.size,
          });
        });
    }

    for (let asset of this.emberEntrypoints(treePaths.htmlTree)) {
      assets.push(asset);
    }

    return assets;
  }

  @Memoize()
  get allActiveAddons(): AddonPackage[] {
    // todo: filter by addon-provided hook
    let shouldInclude = (dep: Package) => dep.isEmberPackage();

    let result = this.appPackage.findDescendants(shouldInclude) as AddonPackage[];
    let extras = [this.synthVendor, this.synthStyles].filter(shouldInclude) as AddonPackage[];
    let extraDescendants = flatMap(extras, dep => dep.findDescendants(shouldInclude)) as AddonPackage[];
    result = [...result, ...extras, ...extraDescendants];
    return result;
  }

  @Memoize()
  get directActiveAddons(): AddonPackage[] {
    // todo: filter by addon-provided hook
    let shouldInclude = (dep: Package) => dep.isEmberPackage();
    return this.appPackage.dependencies.filter(shouldInclude) as AddonPackage[];
  }

  @Memoize()
  resolvableExtensions(): string[] {
    // webpack's default is ['.wasm', '.mjs', '.js', '.json']. Keeping that
    // subset in that order is sensible, since many third-party libraries will
    // expect it to work that way.
    let extensions = ['.wasm', '.mjs', '.js', '.json', '.hbs'];

    // for now, this is hard-coded. If we see ember-cli-typescript, ts files are
    // resolvable. Once we implement a preprocessor-registration build hook,
    // this logic can be pushed down first into `@embroider/compat` (which can
    // generate the appropriate hooks when it upcompiles ember-cli-typescript),
    // and then later into ember-cli-typescript itself (which can ship a v2
    // version with the hook).
    //
    // Typescript is a slightly weird example of a preprocessor because it gets
    // implemented in babel, so all we realy need to do is make the extension
    // resolvable and there's no other "loader" or anything to apply.
    if (this.directActiveAddons.find(pkg => pkg.name === 'ember-cli-typescript')) {
      extensions.unshift('.ts');
    }

    return extensions;
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
        prepare: (dom: JSDOM) => {
          let scripts = [...dom.window.document.querySelectorAll('script')];
          let styles = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];

          return {
            javascript: definitelyReplace(dom, this.oldPackage.findAppScript(scripts), 'app javascript', entrypoint),
            styles: definitelyReplace(dom, this.oldPackage.findAppStyles(styles), 'app styles', entrypoint),
            implicitScripts: definitelyReplace(
              dom,
              this.oldPackage.findVendorScript(scripts),
              'vendor javascript',
              entrypoint
            ),
            implicitStyles: definitelyReplace(
              dom,
              this.oldPackage.findVendorStyles(styles),
              'vendor styles',
              entrypoint
            ),
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
    return this.oldPackage.isModuleUnification ? 'src/main' : 'app';
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
      this.appPackage,
      ...this.allActiveAddons.filter(p => p.meta['auto-upgraded']),
    ]);
  }

  @Memoize()
  templateResolver(): Resolver {
    return new CompatResolver({
      root: this.root,
      modulePrefix: this.modulePrefix(),
      podModulePrefix: this.podModulePrefix(),
      options: this.options,
      activePackageRules: this.activeRules(),
      resolvableExtensions: this.resolvableExtensions(),
    });
  }

  // unlike `templateResolver`, this one brings its own simple TemplateCompiler
  // along so it's capable of parsing component snippets in people's module
  // rules.
  @Memoize()
  private internalTemplateResolver(): CompatResolver {
    let resolver = new CompatResolver({
      root: this.root,
      modulePrefix: this.modulePrefix(),
      options: this.options,
      activePackageRules: this.activeRules(),
      resolvableExtensions: this.resolvableExtensions(),
    });
    // It's ok that this isn't a fully configured template compiler. We're only
    // using it to parse component snippets out of rules.
    resolver.astTransformer(
      new TemplateCompiler({
        compilerPath: resolveSync(this.templateCompilerPath(), { basedir: this.root }),
        EmberENV: {},
        plugins: {},
      })
    );
    return resolver;
  }

  extraImports() {
    let output: { absPath: string; target: string; runtimeName?: string }[][] = [];

    for (let rule of this.activeRules()) {
      if (rule.addonModules) {
        for (let [filename, moduleRules] of Object.entries(rule.addonModules)) {
          for (let root of rule.roots) {
            let absPath = join(root, filename);
            output.push(expandModuleRules(absPath, moduleRules, this.internalTemplateResolver()));
          }
        }
      }
      if (rule.appModules) {
        for (let [filename, moduleRules] of Object.entries(rule.appModules)) {
          let absPath = join(this.root, filename);
          output.push(expandModuleRules(absPath, moduleRules, this.internalTemplateResolver()));
        }
      }
    }
    return flatten(output);
  }

  htmlbarsPlugins(): TemplateCompilerPlugins {
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
    return definitelyReplace(dom, element, '', '');
  }
}

function definitelyReplace(dom: JSDOM, element: Element | undefined, description: string, file: string): Node {
  if (!element) {
    throw new Error(`could not find ${description} in ${file}`);
  }
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
