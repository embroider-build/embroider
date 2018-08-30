import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, pathExists } from 'fs-extra';
import { join, dirname } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import Package from './package';
import App from './app';
import { categorizedImports } from './tracked-imports';

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
}

export default class extends BroccoliPlugin {
  private opts: Options;
  private activeDeps: Package[];

  constructor(classicAppTree: Tree, opts: Options) {
    let activeDeps = opts.package.activeDescendants;
    super([classicAppTree, ...activeDeps.map(a => a.vanillaTree)], {});
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
