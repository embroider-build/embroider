import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, pathExists } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import Package from './package';

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
  package: Package;
}

export default class extends BroccoliPlugin {
  private opts: Options;
  private activeDeps: Package[];

  constructor(appTree: Tree, ownV2Tree: Tree, opts: Options) {
    let activeDeps = opts.package.descendant('activeDependencies');
    super([appTree, ownV2Tree, ...activeDeps.map(a => a.tree)], {});
    this.opts = opts;
    this.activeDeps = activeDeps;
  }

  async build() {
    // todo: copy all addon's App Javascript into ourself

    // for the app tree, we take everything
    //
    // todo: by the time we get here, the app tree has deliberately been
    // un-namespaced so its importable correctly. So we should probably
    // separately track which files originated in 'app'.
    let lazyModules = walkSync(this.inputPaths[0], {
      globs: ['**/*.js'],
      directories: false
    }).map(specifier => `../${specifier.replace(/\.js$/, '')}`);

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    let eagerModules = await this.gatherImplicitImports();

    let appJS = join(this.outputPath, this.opts.outputPath);
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({ lazyModules, eagerModules }), 'utf8');
  }

  private async gatherImplicitImports() {
    let sources = await Promise.all(this.inputPaths.map(async (inputPath, index) => {
      if (index === 0) {
        // our own v1 appTree, which can't have implied imports.
        return;
      }
      let implicitPath = join(inputPath, '_implicit_imports_.js');
      if (await pathExists(implicitPath)) {
        if (index === 1) {
          // our own v2 tree
          return relative(dirname(this.opts.outputPath), './_implicit_imports_');
        } else {
          return `${this.activeDeps[index - 2].name}/_implicit_imports_`;
        }
      }
    }));
    return sources.filter(Boolean);
  }
}
