import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, pathExistsSync } from 'fs-extra';
import { join, dirname } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import App from './app';
import { categorizedImports } from './tracked-imports';
import get from 'lodash/get';
import flatMap from 'lodash/flatmap';
import DependencyAnalyzer from './dependency-analyzer';
import cloneDeep from 'lodash/cloneDeep';
import Workspace from './workspace';

const entryTemplate = compile(`
{{#each eagerModules as |specifier| ~}}
  import '{{js-string-escape specifier}}';
{{/each}}
{{#each lazyModules as |specifier| ~}}
  {{{may-import-sync specifier}}}
{{/each}}
`);

export default class extends BroccoliPlugin {
  constructor(workspace: Workspace, classicAppTree: Tree, private app: App, private analyzer: DependencyAnalyzer){
    super([workspace, classicAppTree, analyzer], {});
  }

  async build() {
    // for the app tree, we take everything
    let lazyModules = walkSync(this.inputPaths[1], {
      globs: ['**/*.js'],
      directories: false
    }).map(specifier => `../${specifier.replace(/\.js$/, '')}`);

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    let eagerModules = await this.gatherImplicitImports();
    let imports = categorizedImports(this.app.name, this.app.implicitImports);
    eagerModules = eagerModules.concat(imports.app);

    let appJS = join(this.outputPath, this.app.appJSPath);
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({ lazyModules, eagerModules }), 'utf8');

    // we are safe to access each addon.packageJSON because all the addon
    // vanillaTrees are in our inputTrees, so we know we are only running after
    // they have built.
    let externals = new Set(flatMap(this.app.activeDescendants, addon => get(addon.packageJSON, 'ember-addon.externals') || []));

    // similarly, we're safe to access analyzer.externals because the analyzer
    // is one of our input trees.
    this.analyzer.externals.forEach(name => externals.add(name));

    // At this point the externals list is correct in the sense that it points
    // out every place a package imports a thing that isnt't listed in its
    // dependencies. But this is stricter than the node_modules resolution
    // algorithm, which lets you get away with importing things that aren't
    // listed, so long as they're resolvable from your location.
    //
    // While it's more correct to list out all your peerDependencies explicitly,
    // in practice lots of packages don't, so it behooves us to be lenient in
    // the same way node is.

    let pkg = cloneDeep(this.app.originalPackageJSON);
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    pkg['ember-addon'].externals = [...externals.values()];
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }

  private async gatherImplicitImports() {
    let result = [];
    for (let addon of this.app.activeDescendants) {
      let implicitPath = join(addon.root, '_implicit_imports_.js');
      if (pathExistsSync(implicitPath)) {
        result.push(`${addon.name}/_implicit_imports_`);
      }
    }
    return result;
  }
}
