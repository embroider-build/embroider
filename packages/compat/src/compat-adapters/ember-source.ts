import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import AddToTree from '../add-to-tree';
import { outputFileSync, readFileSync, readdirSync, unlinkSync } from 'fs-extra';
import { join, resolve } from 'path';
import { Memoize } from 'typescript-memoize';
import { satisfies } from 'semver';
import { transform } from '@babel/core';
import type * as Babel from '@babel/core';
import type { NodePath } from '@babel/traverse';
import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { existsSync } from 'fs';

export default class extends V1Addon {
  get v2Tree() {
    return mergeTrees([super.v2Tree, buildFunnel(this.rootTree, { include: ['dist/ember-template-compiler.js'] })]);
  }

  private get useStaticEmber(): boolean {
    return this.app.options.staticEmberSource;
  }

  // versions of ember-source prior to
  // https://github.com/emberjs/ember.js/pull/20675 ship dist/packages and
  // dist/dependencies separately and the imports between them are package-name
  // imports. Since many of the dependencies are also true package.json
  // dependencies (in order to get typescript types), and our module-resolver
  // prioritizes true dependencies, it's necessary to detect and remove the
  // package.json dependencies.
  //
  // After the above linked change, ember-source ships only dist/packages and
  // the inter-package imports are all relative. Some of the things in
  // dist/packages are still the rolled-in dependencies, but now that the
  // imports are all relative we need no special handling for them (beyond the
  // normal v2 addon renamed-modules support.
  @Memoize()
  private get includedDependencies() {
    let result: string[] = [];
    let depsDir = resolve(this.root, 'dist', 'dependencies');
    if (!existsSync(depsDir)) {
      return result;
    }
    for (let name of readdirSync(depsDir)) {
      if (name[0] === '@') {
        for (let innerName of readdirSync(resolve(this.root, 'dist', 'dependencies', name))) {
          if (innerName.endsWith('.js')) {
            result.push(name + '/' + innerName.slice(0, -3));
          }
        }
      } else {
        if (name.endsWith('.js')) {
          result.push(name.slice(0, -3));
        }
      }
    }
    return result;
  }

  get newPackageJSON() {
    let json = super.newPackageJSON;
    if (this.useStaticEmber) {
      for (let name of this.includedDependencies) {
        // weirdly, many of the inlined dependency are still listed as real
        // dependencies too. If we don't delete them here, they will take
        // precedence over the inlined ones, because the embroider module-resolver
        // tries to prioritize real deps.
        delete json.dependencies?.[name];
      }
    }
    return json;
  }

  customizes(treeName: string) {
    if (this.useStaticEmber) {
      // we are adding custom implementations of these
      return treeName === 'treeForAddon' || treeName === 'treeForVendor' || super.customizes(treeName);
    } else {
      return super.customizes(treeName);
    }
  }

  invokeOriginalTreeFor(name: string, opts: { neuterPreprocessors: boolean } = { neuterPreprocessors: false }) {
    if (this.useStaticEmber) {
      if (name === 'addon') {
        return this.customAddonTree();
      }
      if (name === 'vendor') {
        return this.customVendorTree();
      }
    }
    return super.invokeOriginalTreeFor(name, opts);
  }

  // Our addon tree is all of the "packages" we share. @embroider/compat already
  // supports that pattern of emitting modules into other package's namespaces.
  private customAddonTree() {
    let packages = buildFunnel(this.rootTree, {
      srcDir: 'dist/packages',
    });

    let trees: Node[] = [
      packages,
      buildFunnel(this.rootTree, {
        srcDir: 'dist/dependencies',
        allowEmpty: true,
      }),
    ];

    if (satisfies(this.packageJSON.version, '>= 4.0.0-alpha.0 <4.10.0-alpha.0', { includePrerelease: true })) {
      // import { loc } from '@ember/string' was removed in 4.0. but the
      // top-level `ember` package tries to import it until 4.10. A
      // spec-compliant ES modules implementation will treat this as a parse
      // error.
      trees.push(new FixStringLoc([packages]));
    }

    return mergeTrees(trees, { overwrite: true });
  }

  // We're zeroing out these files in vendor rather than deleting them, because
  // we can't easily intercept the `app.import` that presumably exists for them,
  // so rather than error they will just be empty.
  //
  // The reason we're zeroing these out is that we're going to consume all our
  // modules directly out of treeForAddon instead, as real modules that webpack
  // can see.
  private customVendorTree() {
    return new AddToTree(this.addonInstance._treeFor('vendor'), outputPath => {
      unlinkSync(join(outputPath, 'ember', 'ember.js'));
      outputFileSync(join(outputPath, 'ember', 'ember.js'), '');
      unlinkSync(join(outputPath, 'ember', 'ember-testing.js'));
      outputFileSync(join(outputPath, 'ember', 'ember-testing.js'), '');
    });
  }

  get packageMeta() {
    let meta = super.packageMeta;
    if (this.useStaticEmber) {
      if (!meta['implicit-modules']) {
        meta['implicit-modules'] = [];
      }
      meta['implicit-modules'].push('./ember/index.js');
      // before 5.6, Ember uses the AMD loader to decide if it's test-only parts
      // are present, so we must ensure they're registered. After that it's
      // enough to evaluate ember-testing, which @embroider/core is hard-coded
      // to do in the backward-compatible tests bundle.
      if (!satisfies(this.packageJSON.version, '>= 5.6.0-alpha.0', { includePrerelease: true })) {
        if (!meta['implicit-test-modules']) {
          meta['implicit-test-modules'] = [];
        }
        meta['implicit-test-modules'].push('./ember-testing/index.js');
      }
    }
    return meta;
  }
}

class FixStringLoc extends Plugin {
  build() {
    let inSource = readFileSync(resolve(this.inputPaths[0], 'ember', 'index.js'), 'utf8');
    let outSource = transform(inSource, {
      plugins: [fixStringLoc],
      configFile: false,
    })!.code!;
    outputFileSync(resolve(this.outputPath, 'ember', 'index.js'), outSource, 'utf8');
  }
}

function fixStringLoc(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program(path: NodePath<Babel.types.Program>) {
        path.node.body.unshift(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier('loc'), t.identifier('undefined'))])
        );
      },
      ImportDeclaration: {
        enter(path: NodePath<Babel.types.ImportDeclaration>, state: { inEmberString: boolean }) {
          if (path.node.source.value === '@ember/string') {
            state.inEmberString = true;
          }
        },
        exit(_path: NodePath<Babel.types.ImportDeclaration>, state: { inEmberString: boolean }) {
          state.inEmberString = false;
        },
      },
      ImportSpecifier(path: NodePath<Babel.types.ImportSpecifier>, state: { inEmberString: boolean }) {
        let name = 'value' in path.node.imported ? path.node.imported.value : path.node.imported.name;
        if (state.inEmberString && name === 'loc') {
          path.remove();
        }
      },
    },
  };
}
