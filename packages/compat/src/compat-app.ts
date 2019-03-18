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
  TemplateCompiler
} from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import DependencyAnalyzer from './dependency-analyzer';
import { V1Config } from './v1-config';
import { statSync, readdirSync } from 'fs';
import Options, { optionsWithDefaults } from './options';
import CompatResolver from './resolver';
import { activePackageRules, PackageRules, expandModuleRules } from './dependency-rules';
import flatMap from 'lodash/flatMap';
import { Memoize } from 'typescript-memoize';
import flatten from 'lodash/flatten';
import { sync as resolveSync } from 'resolve';

interface TreeNames {
  appJS: Tree;
  analyzer: Tree;
  htmlTree: Tree;
  publicTree: Tree;
  configTree: Tree;
}

// This runs at broccoli-pipeline-construction time, whereas our actual
// CompatAppAdapter instance only becomes available during tree-building
// time.
function setup(legacyEmberAppInstance: object, options: Required<Options> ) {
  let oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance, options).app;

  let { analyzer, appJS } = oldPackage.processAppJS();
  let htmlTree = oldPackage.htmlTree;
  let publicTree = oldPackage.publicTree;
  let configTree = oldPackage.config;

  if (options.extraPublicTrees.length > 0) {
    publicTree = mergeTrees([publicTree, ...options.extraPublicTrees].filter(Boolean));
  }

  let inTrees = {
    appJS,
    analyzer,
    htmlTree,
    publicTree,
    configTree,
  };

  let instantiate = async (root: string, appSrcDir: string, packageCache: PackageCache) => {
    let appPackage = packageCache.getApp(appSrcDir);
    let adapter = new CompatAppAdapter(
      root,
      appPackage,
      options,
      oldPackage,
      configTree,
      analyzer,
      packageCache.getAddon(join(root, 'node_modules', '@embroider', 'synthesized-vendor')),
      packageCache.getAddon(join(root, 'node_modules', '@embroider', 'synthesized-styles')),
    );

    return new AppBuilder<TreeNames>(root, appPackage, adapter, options);
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
    private analyzer: DependencyAnalyzer,
    private synthVendor: Package,
    private synthStyles: Package,
  ) {}

  appJSSrcDir(treePaths: OutputPaths<TreeNames>) {
    return treePaths.appJS;
  }

  assets(treePaths: OutputPaths<TreeNames>): Asset[] {
    let assets: Asset[] = [];

    // Everything in our traditional public tree is an on-disk asset
    if (treePaths.publicTree) {
      walkSync.entries(treePaths.publicTree, {
        directories: false,
      }).forEach((entry) => {
        assets.push({
          kind: 'on-disk',
          relativePath: entry.relativePath,
          sourcePath: entry.fullPath,
          mtime: entry.mtime as unknown as number, // https://github.com/joliss/node-walk-sync/pull/38
          size: entry.size
        });
      });
    }

    for (let asset of this.emberEntrypoints(treePaths.htmlTree)) {
      assets.push(asset);
    }

    return assets;
  }

  @Memoize()
  get activeAddonDescendants(): Package[] {
    // todo: filter by addon-provided hook
    let shouldInclude = (dep: Package) => dep.isEmberPackage;

    let result = this.appPackage.findDescendants(shouldInclude);
    let extras = [this.synthVendor, this.synthStyles].filter(shouldInclude);
    let extraDescendants = flatMap(extras, dep => dep.findDescendants(shouldInclude));
    result = [...result, ...extras, ...extraDescendants];
    return result;
  }

  private * emberEntrypoints(htmlTreePath: string): IterableIterator<Asset> {
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
          let scripts = [...dom.window.document.querySelectorAll("script")];
          let styles = [
            ...dom.window.document.querySelectorAll('link[rel="stylesheet"]'),
          ] as HTMLLinkElement[];

          return {
            javascript: definitelyReplace(dom, this.oldPackage.findAppScript(scripts), 'app javascript', entrypoint),
            styles: definitelyReplace(dom, this.oldPackage.findAppStyles(styles), 'app styles', entrypoint),
            implicitScripts: definitelyReplace(dom, this.oldPackage.findVendorScript(scripts), 'vendor javascript', entrypoint),
            implicitStyles: definitelyReplace(dom, this.oldPackage.findVendorStyles(styles), 'vendor styles', entrypoint),
            testJavascript: maybeReplace(dom, this.oldPackage.findTestScript(scripts)),
            implicitTestScripts: maybeReplace(dom, this.oldPackage.findTestSupportScript(scripts)),
            implicitTestStyles: maybeReplace(dom, this.oldPackage.findTestSupportStyles(styles)),
          };
        }
      };
      yield asset;
    }
  }

  autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  mainModule(): string {
    return this.oldPackage.isModuleUnification ? "src/main" : "app";
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

  templateCompilerPath(): string {
    return 'ember-source/vendor/ember/ember-template-compiler';
  }

  @Memoize()
  private activeRules() {
    return activePackageRules(
      this.options.packageRules.concat(defaultAddonPackageRules()),
      [this.appPackage, ...this.activeAddonDescendants]
    );
  }

  @Memoize()
  templateResolver(): Resolver {
    return new CompatResolver(
      this.root,
      this.modulePrefix(),
      this.options,
      this.activeRules(),
    );
  }

  // unlink `templateResolver`, this one brings its own simple TemplateCompiler
  // along so it's capable of parsing component snippets in people's module
  // rules.
  @Memoize()
  private internalTemplateResolver(): CompatResolver {
    let resolver = new CompatResolver(
      this.root,
      this.modulePrefix(),
      this.options,
      this.activeRules(),
    );
    // It's ok that this isn't a fully configured template compiler. We're only
    // using it to parse component snippets out of rules.
    resolver.astTransformer(new TemplateCompiler({
      compilerPath: resolveSync(this.templateCompilerPath(), { basedir: this.root }),
      EmberENV: {},
      plugins: {},
    }));
    return resolver;
  }

  extraImports() {
    let output: { absPath: string, target: string }[][] = [];

    for (let rule of this.activeRules()) {
      if (rule.addonModules) {
        for(let [filename, moduleRules] of Object.entries(rule.addonModules)) {
          for (let root of rule.roots) {
            let absPath = join(root, filename);
            output.push(expandModuleRules(absPath, moduleRules, this.internalTemplateResolver()));
          }
        }
      }
      if (rule.appModules) {
        for(let [filename, moduleRules] of Object.entries(rule.appModules)) {
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

  babelConfig() {
    return this.oldPackage.babelConfig();
  }

  externals(): string[] {
    return this.analyzer.externals;
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
    return definitelyReplace(dom, element, "", "");
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
  return readdirSync(join(__dirname, 'addon-dependency-rules')).map(filename => {
    if (filename.endsWith('.js')) {
      return require(join(__dirname, 'addon-dependency-rules', filename)).default;
    }
  }).filter(Boolean).reduce((a,b) => a.concat(b), []);
}
