import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import { Memoize } from 'typescript-memoize';
import makeDebug from 'debug';
import quickTemp from 'quick-temp';
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';
import ImportParser from './import-parser';
import babelPlugin from './babel-plugin';
import semver from 'semver';

registerHelper('js-string-escape', jsStringEscape);

const todo = makeDebug('ember-cli-vanilla:todo');

const appImportsTemplate = compile(`{{#each imports as |import|}}
import '{{js-string-escape import}}';
{{/each}}`);

// represents a v2 package
export default abstract class Package {
  get tree(): Tree {
    let trees = this.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.name
    });
  }

  abstract name: string;
  abstract hasAnyTrees(): boolean;
  protected abstract v2Trees(): Tree[];
  protected abstract options: any;
  protected abstract preprocessJS(tree: Tree) : Tree;

  protected transpile(tree) {
    this.checkBabelConfig();

    tree = this.preprocessJS(tree);

    // TODO: for Javascript, this should respect the addon's configured babel
    // plugins but only target ES latest, leaving everything else (especially
    // modules) intact. For templates, this should apply custom AST transforms
    // and re-serialize. For styles, this should apply any custom registered
    // style transforms down to plain CSS.a
    //
    // All of these steps can be optimized away when we see there is are no
    // special preprocessors registered that wouldn't already be handled by the
    // app-wide final babel and/or template compilation.
    //
    // TODO: also remember to add our own babel plugin that rewrites absolute
    // specifiers within the same package to relative specifiers.
    return tree;
  }

  protected parseImports(tree) {
    return new ImportParser(tree);
  }

  @Memoize()
  protected checkBabelConfig() {
    let options = this.options;

    let emberCLIBabelInstance = this.findAddonByName('ember-cli-babel');
    let version;
    if (emberCLIBabelInstance) {
      version = require(join(emberCLIBabelInstance.root, 'package')).version;
    }

    if (version && semver.satisfies(version, '^5')) {
      todo(`${this.name} is using babel 5.`);
      return;
    }

    Object.assign(options['ember-cli-babel'], {
      compileModules: false,
      disablePresetEnv: true,
      disableDebugTooling: true,
      disableEmberModulesAPIPolyfill: true
    });
    if (!options.babel.plugins) {
      options.babel.plugins = [];
    }
    options.babel.plugins.push([babelPlugin, { ownName: this.name } ]);
  }

  protected abstract directAddons;

  protected findAddonByName(name) {
    return this.directAddons.find(a => a.name === name || (a.pkg && a.pkg.name === name));
  }

  protected abstract trackedImports;

  protected implicitImportTree() {
    if (!this.trackedImports) {
      return;
    }

    let appImports = [];
    let testImports = [];

    this.trackedImports.forEach(({ assetPath, options }) => {
      let standardAssetPath = standardizeAssetPath(assetPath);
      if (!standardAssetPath) {
        return;
      }
      if (options.type === 'vendor') {
        if (options.outputFile && options.outputFile !== '/assets/vendor.js') {
          todo(`${this.name} is app.importing vendor assets into a nonstandard output file ${options.outputFile}`);
        }
        appImports.push(standardAssetPath);
      } else if (options.type === 'test') {
        testImports.push(standardAssetPath);
      } else {
        todo(`${this.name} has a non-standard app.import type ${options.type} for asset ${assetPath}`);
      }
    });
    if (appImports.length === 0 && testImports.length === 0) {
      return;
    }
    quickTemp.makeOrRemake(this, 'implicitImportDir');
    if (appImports.length > 0) {
      writeFileSync(join(this.implicitImportDir, `_implicit_imports_.js`), appImportsTemplate({ imports: appImports }), 'utf8');
    }
    if (testImports.length > 0) {
      writeFileSync(join(this.implicitImportDir, `_implicit_test_imports_.js`), appImportsTemplate({ imports: testImports }), 'utf8');
    }
    return new UnwatchedDir(this.implicitImportDir);
  }
  private implicitImportDir;
}

function standardizeAssetPath(assetPath) {
  let [first, ...rest] = assetPath.split('/');
  if (first === 'vendor') {
    // our vendor tree is available via relative import
    return './vendor/' + rest.join('/');
  } else if (first === 'node_modules') {
    // our node_modules are allowed to be resolved directly
    return rest.join('/');
  } else {
    todo(`${this.name} app.imported from unknown path ${assetPath}`);
  }
}
