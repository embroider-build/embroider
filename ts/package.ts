import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import RewritePackageJSON from './rewrite-package-json';
import { sync as pkgUpSync }  from 'pkg-up';

// represents a v2 package
export default class Package {
  static fromV1(addonInstance) : Package {
    return new this(addonInstance);
  }

  private constructor(private addonInstance) {}

  get tree(): Tree {
    let trees = this.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.name
    });
  }

  get name() : string {
    return this.addonInstance.pkg.name;
  }

  // addonInstance.root gets modified by a customized "main" or
  // "ember-addon.main" in package.json. We want the real package root here
  // (the place where package.json lives).
  private get root(): string {
    if (!this.rootCache) {
      this.rootCache = dirname(pkgUpSync(this.addonInstance.root));
    }
    return this.rootCache;
  }
  private rootCache;

  private get mainModule() {
    if (!this.mainModuleCache) {
      this.mainModuleCache = require(this.addonInstance.constructor._meta_.modulePath);
    }
    return this.mainModuleCache;
  }
  private mainModuleCache;

  private customizes(...treeNames) {
    return treeNames.find(treeName => this.mainModule[treeName]);
  }

  private v2Trees() {
    let { addonInstance } = this;
    let trees = [];

    let rootTree = new UnwatchedDir(this.root);
    trees.push(new RewritePackageJSON(rootTree));

    if (this.customizes('treeFor')) {
      console.log(`TODO: ${this.name} has customized treeFor`);
      return trees;
    }

    if (this.customizes('treeForAddon', 'treeForAddonTemplates')) {
      console.log(`TODO: ${this.name} may have customized the addon tree`);
    } else {
      if (existsSync(join(this.root, 'addon'))) {
        // TODO: track all the javascript in here for inclusion in our automatic
        // implied imports.
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon',
            exclude: ['styles/**']
          }))
        );
      }
    }

    if (this.customizes('treeForAddonStyles')) {
      console.log(`TODO: ${this.name} may have customized the addon style tree`);
    } else {
      if (existsSync(join(this.root, 'addon/styles'))) {
        // TODO should generate `import "this-addon/addon.css";` to maintain
        // auto inclusion semantics.
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon/styles'
          }))
      );
      }
    }

    if (this.customizes('treeForStyles')) {
      console.log(`TODO: ${this.name} may have customized the app style tree`);
    } else {
      if (existsSync(join(this.root, 'app/styles'))) {
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
          new Funnel(rootTree, {
            srcDir: 'app/styles',
            destDir: '_app_styles_'
          })
      );
      }
    }

    if (this.customizes('treeForAddonTestSupport')) {
      console.log(`TODO: ${this.name} may have customized the addon test support tree`);
    } else {
      if (existsSync(join(this.root, 'addon-test-support'))) {
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon-test-support',
            destDir: 'test-support'
          }))
      );
      }
    }

    if (this.customizes('treeForTestSupport')) {
      console.log(`TODO: ${this.name} may have customized the test support tree`);
    } else {
      if (existsSync(join(this.root, 'test-support'))) {
        // this case should probably get deprecated entirely, there's no good
        // reason to use this over addon-test-support.
        console.log(`TODO: ${this.name} is using test-support instead of addon-test-support`);
      }
    }

    if (this.customizes('treeForApp', 'treeForTemplates')) {
      console.log(`TODO: ${this.name} may have customized the app tree`);
    } else {
      if (existsSync(join(this.root, 'app'))) {
        trees.push(
          // TODO track all the Javascript in here and put it into our implied
          // automatic imports.
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'app',
            exclude: ['styles/**'],
            destDir: '_app_'
          }))
        );
      }
    }

    if (this.customizes('treeForPublic')) {
      console.log(`TODO: ${this.name} may have customized the public tree`);
    } else {
      if (existsSync(join(this.root, 'public'))) {
        trees.push(
          new Funnel(rootTree, {
            srcDir: 'public',
            destDir: 'public'
          })
        );
      }
    }

    if (this.customizes('treeForVendor')) {
      console.log(`TODO: ${this.name} may have customized the vendor tree`);
    } else {
      if (existsSync(join(this.root, 'vendor'))) {
        trees.push(
          new Funnel(rootTree, {
            srcDir: 'vendor',
            destDir: '_vendor_'
          })
        );
      }
    }

    return trees;
  }
}

function transpile(_addonInstance, tree) {
  // TODO: for Javascript, this should respect the addon's configured babel
  // plugins but only target ES latest, leaving everything else (especially
  // modules) intact. For templates, this should apply custom AST transforms and
  // re-serialize.
  //
  // Both of these steps can be optimized away when we see there is are no
  // special preprocessors registered that wouldn't already be handled by the
  // app-wide final babel and/or template compilation.
  return tree;
}
