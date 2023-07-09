import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import AddToTree from '../add-to-tree';
import { outputFileSync, readdirSync, unlinkSync } from 'fs-extra';
import { join, resolve } from 'path';
import { Memoize } from 'typescript-memoize';

export default class extends V1Addon {
  get v2Tree() {
    return mergeTrees([super.v2Tree, buildFunnel(this.rootTree, { include: ['dist/ember-template-compiler.js'] })]);
  }

  // ember-source inlines a whole bunch of dependencies into itself
  @Memoize()
  private get includedDependencies() {
    let result: string[] = [];
    for (let name of readdirSync(resolve(this.root, 'dist', 'dependencies'))) {
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
    for (let name of this.includedDependencies) {
      // weirdly, many of the inlined dependency are still listed as real
      // dependencies too. If we don't delete them here, they will take
      // precedence over the inlined ones, because the embroider module-resolver
      // tries to prioritize real deps.
      delete json.dependencies?.[name];
    }
    return json;
  }

  customizes(treeName: string) {
    // we are adding custom implementations of these
    return treeName === 'treeForAddon' || treeName === 'treeForVendor' || super.customizes(treeName);
  }

  invokeOriginalTreeFor(name: string, opts: { neuterPreprocessors: boolean } = { neuterPreprocessors: false }) {
    if (name === 'addon') {
      return this.customAddonTree();
    }
    if (name === 'vendor') {
      return this.customVendorTree();
    }
    return super.invokeOriginalTreeFor(name, opts);
  }

  // Our addon tree is all of the "packages" we share. @embroider/compat already
  // supports that pattern of emitting modules into other package's namespaces.
  private customAddonTree() {
    return mergeTrees([
      buildFunnel(this.rootTree, {
        srcDir: 'dist/packages',
      }),
      buildFunnel(this.rootTree, {
        srcDir: 'dist/dependencies',
      }),
    ]);
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

    if (!meta['implicit-modules']) {
      meta['implicit-modules'] = [];
    }
    meta['implicit-modules'].push('./ember/index.js');

    // this is the same check ember-source's own code does
    const isProduction = process.env.EMBER_ENV === 'production';

    if (!isProduction) {
      // one might ask whether we could use implicit-test-modules instead.
      // Unfortunately, no, ember-source includes these things in dev not just
      // test, and some addons like ember-data break without it.
      meta['implicit-modules'].push('./ember-testing/index.js');
    }

    return meta;
  }
}
