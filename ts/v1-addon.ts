import V1Package from "./v1-package";
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import { existsSync } from 'fs-extra';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';
import { todo, unsupported } from './messages';
import { TrackedImports } from './tracked-imports';
import MultiFunnel from './multi-funnel';
import ImportParser from './import-parser';
import { Tree } from "broccoli-plugin";
import mergeTrees from 'broccoli-merge-trees';
import semver from 'semver';
import { renamed } from "./renaming";
import Snitch from './snitch';

const stockTreeNames = Object.freeze([
  'addon',
  'addon-styles',
  'styles',
  'addon-test-support',
  'test-support',
  'app',
  'public',
  'vendor',
  // 'addon-templates' and 'templates are trees too, but they live inside
  // 'addon' and 'app' and we handle them there.
]);

const appPublicationDir = '_app_';

// This controls and types the interface between our new world and the classic
// v1 addon instance.
export default class V1Addon implements V1Package {
  constructor(protected addonInstance, public parent: V1Package) {
    this.updateBabelConfig();
  }

  get name() {
    return this.packageJSON.name;
  }

  protected get packageJSON() {
    return this.addonInstance.pkg;
  }

  @Memoize()
  get root(): string {
    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here
    // (the place where package.json lives).
    return dirname(pkgUpSync(this.addonInstance.root));
  }

  private parseImports(tree) {
    return new ImportParser(tree);
  }

  @Memoize()
  private get mainModule() {
    return require(this.addonInstance.constructor._meta_.modulePath);
  }

  private get options() {
    if (!this.addonInstance.options) {
      this.addonInstance.options = {};
    }
    return this.addonInstance.options;
  }

  protected customizes(...treeNames) {
    return treeNames.find(treeName => this.mainModule[treeName]);
  }

  @Memoize()
  private hasStockTree(treeName) {
    return this.addonInstance.treePaths && existsSync(join(this.root, this.addonInstance.treePaths[treeName]));
  }

  hasAnyTrees() : boolean {
    return Boolean(stockTreeNames.find(name => this.hasStockTree(name)));
  }

  protected stockTree(treeName, funnelOpts?) {
    let opts = Object.assign({
      srcDir: this.addonInstance.treePaths[treeName]
    }, funnelOpts);
    return new Funnel(this.rootTree, opts);
  }

  @Memoize()
  private get rootTree() {
    return new UnwatchedDir(this.root);
  }

  // In an ideal world, there would be no options to this. We would just run
  // every kind of tree through every kind of transpiler, and they could freely
  // mix JS, CSS, and HBS. Unfortunately, some existing transpiler plugins like
  // embrer-cli-sass will blow up if they don't find some files.
  private transpile(tree, { includeCSS } = { includeCSS: false}) {
    if (includeCSS) {
      tree = this.addonInstance.compileStyles(tree);
    }
    return this.addonInstance.preprocessJs(tree, '/', this.addonInstance.name, {
      registry : this.addonInstance.registry
    });
  }

  @Memoize()
  private updateBabelConfig() {
    // auto-import gets disabled because we support it natively
    //this.addonInstance.registry.remove('js', 'ember-auto-import-analyzer');

    let packageOptions = this.options;
    let emberCLIBabelInstance = this.addonInstance.addons.find(a => a.name === 'ember-cli-babel');
    let version;

    if (emberCLIBabelInstance) {
      version = require(join(emberCLIBabelInstance.root, 'package')).version;
    }

    if (!packageOptions['ember-cli-babel']) {
      packageOptions['ember-cli-babel'] = {};
    }

    if (!packageOptions.babel) {
      packageOptions.babel = {};
    }

    Object.assign(packageOptions['ember-cli-babel'], {
      compileModules: false,
      disablePresetEnv: true,
      disableDebugTooling: true,
      disableEmberModulesAPIPolyfill: true
    });

    if (version && semver.satisfies(version, '^5')) {
      unsupported(`${this.name} is using babel 5. Not installing our custom plugin.`);
      return;
    }

    if (!packageOptions.babel.plugins) {
      packageOptions.babel.plugins = [];
    }
    packageOptions.babel.plugins.push([require.resolve('./babel-plugin'), {
      ownName: this.name,
      rename: renamed(this.addonInstance.addons)
    } ]);
  }

  protected get v2Trees() {
    return this.makeV2Trees().trees;
  }

  get v2Tree() {
    return mergeTrees(this.v2Trees);
  }

  get packageJSONRewriter() {
    return this.makeV2Trees().packageJSONRewriter;
  }

  // this is split out so that compatability shims can override it to add more
  // things to the package metadata.
  protected get packageMeta() {
    return this.legacyTrees().meta;
  }

  @Memoize()
  private makeV2Trees() {
    let { trees, importParsers } = this.legacyTrees();
    let analyzer = new DependencyAnalyzer(importParsers, this.packageJSON, false );
    let packageJSONRewriter = new RewritePackageJSON(this.rootTree, analyzer, this.packageMeta);
    trees.push(packageJSONRewriter);
    return { trees, packageJSONRewriter };
  }

  protected invokeOriginalTreeFor(name) {
    return this.addonInstance._treeFor(name);
  }

  protected treeForAddon(): Tree|undefined {
    if (this.customizes('treeForAddon', 'treeForAddonTemplates')) {
      return new MultiFunnel(this.invokeOriginalTreeFor('addon'), {
        srcDirs: [this.addonInstance.name, `modules/${this.addonInstance.name}`]
      });
      // todo: also invoke treeForAddonTemplates
    } else if (this.hasStockTree('addon')) {
      return this.transpile(this.stockTree('addon', {
        exclude: ['styles/**']
      }));
    }
  }

  protected addonStylesTree(): Tree|undefined {
    if (this.customizes('treeForAddonStyles')) {
      todo(`${this.name} may have customized the addon style tree`);
    } else if (this.hasStockTree('addon-styles')) {
      return this.transpile(this.stockTree('addon-styles'), { includeCSS: true });
    }
  }

  protected treeForTestSupport(): Tree|undefined {
    if (this.customizes('treeForTestSupport')) {
      todo(`${this.name} has customized the test support tree`);
    } else if (this.hasStockTree('test-support')) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app. For example, imports should be relative to
      // the consuming app, not our own package. That is some of what is lame
      // about app trees and why they will go away once everyone is all MU.
      return new Funnel(this.stockTree('test-support'), {
        destDir: `${appPublicationDir}/tests`
      });
    }
  }

  @Memoize()
  private legacyTrees() : { trees: Tree[], importParsers: ImportParser[], meta: any } {
    let trees = [];
    let importParsers = [];
    let meta = {};

    {
      let tracked = new TrackedImports(this.name, this.addonInstance._trackedImports);
      Object.assign(meta, tracked.meta);
    }

    if (this.customizes('treeFor')) {
      unsupported(`${this.name} has customized treeFor`);
    }

    {
      let addonTree = this.treeForAddon();
      if (addonTree) {
        importParsers.push(this.parseImports(addonTree));
        trees.push(addonTree);
      }
    }

    {
      let addonStylesTree = this.addonStylesTree();
      if (addonStylesTree) {
        trees.push(addonStylesTree);
        if (!meta['implicit-styles']) {
          meta['implicit-styles'] = [];
        }
        meta['implicit-styles'].push(`./${this.name}.css`);
      }
    }

    if (this.customizes('treeForStyles')) {
      todo(`${this.name} may have customized the app style tree`);
    } else if (this.hasStockTree('styles')) {
      // The typical way these get used is via css @import from the app's own
      // CSS (or SCSS). There is no enforced namespacing but that is the
      // common pattern as far as I can tell.
      //
      // TODO: detect people doing the right thing (namespacing with their own
      // package name) and send them down the happy path. Their styles can
      // just ship inside the package root and be importable at the same name
      // as before. Detect people doing anything other than that and yell at
      // them and set up a fallback.
      trees.push(
        this.transpile(this.stockTree('styles', {
          destDir: '_app_styles_'
        }), { includeCSS: true })
      );
    }

    {
      let addonTestSupportTree;
      if (this.customizes('treeForAddonTestSupport')) {
        addonTestSupportTree = new Snitch(
          this.invokeOriginalTreeFor('addon-test-support'),
          {
            // the normal behavior (when the addon doesn't customize or when
            // they at least call `super`) is to namespace their stuff under
            // my-addon-name/test-support. Addons that don't do that are asking
            // for trouble.
            allowedPaths: new RegExp(`^${this.name}/test-support/`),
            description: `${this.name} treeForAddonTestSupport`,
          }, {
            srcDir: this.name
          }
        );
      } else if (this.hasStockTree('addon-test-support')) {
        addonTestSupportTree = this.transpile(this.stockTree('addon-test-support', {
          destDir: 'test-support'
        }));
      }
      if (addonTestSupportTree) {
        importParsers.push(this.parseImports(addonTestSupportTree));
        trees.push(addonTestSupportTree);
      }
    }

    {
      let tree = this.treeForTestSupport();
      if (tree) {
        importParsers.push(this.parseImports(tree));
        trees.push(tree);
        meta['app-js'] = appPublicationDir;
      }
    }

    if (this.customizes('treeForApp', 'treeForTemplates')) {
      todo(`${this.name} may have customized the app tree`);
    }
    if (this.hasStockTree('app')) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app. For example, imports should be relative to
      // the consuming app, not our own package. That is some of what is lame
      // about app trees and why they will go away once everyone is all MU.
      //
      // This does need to go through parseImports here, because by the time
      // these files have been merged into the app we can't tell what their
      // allowed dependencies are anymore and would get false positive
      // externals.
      meta['app-js'] = appPublicationDir;
      let tree = this.stockTree('app', {
        exclude: ['styles/**'],
        destDir: appPublicationDir
      });
      importParsers.push(this.parseImports(tree));
      trees.push(tree);
    }

    if (this.customizes('treeForPublic')) {
      let tree = this.invokeOriginalTreeFor('public');
      if (tree) {
        trees.push(
          new Snitch(tree, {
            // The normal behavior is to namespace your public files under your
            // own name. But addons can flaunt that, and that goes beyond what
            // the v2 format is allowed to do.
            allowedPaths: new RegExp(`^${this.name}/`),
            description: `${this.name} treeForPublic`
          }, {
            destDir: 'public'
          })
        );
      }
    } else if (this.hasStockTree('public')) {
      trees.push(
        this.stockTree('public', {
          destDir: 'public'
        })
      );
    }

    if (this.customizes('treeForVendor')) {
      // We don't have any particular opinions about the structure inside
      // vendor, so even when it's customized we can just use the customized
      // one.
      let tree = this.invokeOriginalTreeFor('vendor');
      if (tree) {
        trees.push(
          new Funnel(tree, {
            destDir: 'vendor'
          })
        );
      }
    } else if (this.hasStockTree('vendor')) {
      trees.push(
        this.stockTree('vendor', {
          destDir: 'vendor'
        })
      );
    }

    return { trees, importParsers, meta };
  }
}

export interface V1AddonConstructor {
  new(addonInstance, parent: V1Package): V1Addon;
}
