import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, pathExists } from 'fs-extra';
import { join, dirname } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import Addon from './addon';
import App from './app';
import { categorizedImports } from './tracked-imports';
import get from 'lodash/get';
import DependencyAnalyzer from './dependency-analyzer';
import cloneDeep from 'lodash/cloneDeep';

const entryTemplate = compile(`
{{#each eagerModules as |specifier| ~}}
  import '{{js-string-escape specifier}}';
{{/each}}
{{#each lazyModules as |specifier| ~}}
  {{{may-import-sync specifier}}}
{{/each}}
`);

export interface Options {
  outputPath: string;
  package: App;
  analyzer: DependencyAnalyzer;
}

export default class extends BroccoliPlugin {
  private opts: Options;
  private activeDeps: Addon[];

  constructor(classicAppTree: Tree, opts: Options) {
    // todo: only the deps with !dep.isNativeV2 should go into inputTrees. The
    // native ones are already built and stable.
    let activeDeps = opts.package.activeDescendants;
    super([classicAppTree, ...activeDeps.map(a => a.vanillaTree), opts.analyzer], {});
    this.opts = opts;
    this.activeDeps = activeDeps;
  }

  async build() {
    // for the app tree, we take everything
    let lazyModules = walkSync(this.inputPaths[0], {
      globs: ['**/*.js'],
      directories: false
    }).map(specifier => `../${specifier.replace(/\.js$/, '')}`);

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    let eagerModules = await this.gatherImplicitImports();
    let imports = categorizedImports(this.opts.package.name, this.opts.package.implicitImports);
    eagerModules = eagerModules.concat(imports.app);

    let appJS = join(this.outputPath, this.opts.outputPath);
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({ lazyModules, eagerModules }), 'utf8');

    // we are safe to access each addon.packageJSON because all the addon
    // vanillaTrees are in our inputTrees, so we know we are only running after
    // they have built.
    let externals = new Set(flatMap(this.activeDeps, addon => get(addon.packageJSON, 'ember-addon.externals') || []));

    // similarly, we're safe to access analyzer.externals because the analyzer
    // is one of our input trees.
    this.opts.analyzer.externals.forEach(name => externals.add(name));

    let pkg = cloneDeep(this.opts.package.originalPackageJSON);
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    pkg['ember-addon'].externals = [...externals.values()];
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }

  private async gatherImplicitImports() {
    let sources = await Promise.all(this.inputPaths.map(async (inputPath, index) => {
      if (index === 0) {
        // the combined appTree, which can't have implied imports
        return;
      }
      let implicitPath = join(inputPath, '_implicit_imports_.js');
      if (await pathExists(implicitPath)) {
        return `${this.activeDeps[index - 1].name}/_implicit_imports_`;
      }
    }));
    return sources.filter(Boolean);
  }
}
