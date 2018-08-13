import BroccoliPlugin from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync } from 'fs-extra';
import { join, dirname } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import AppPackage from './app-package';

const entryTemplate = compile(`
{{#each specifiers as |specifier|}}
  {{{may-import-sync specifier}}}
{{/each}}
`);

export interface Options {
  appPackage: AppPackage;
  outputPath: string;
}

export default class extends BroccoliPlugin {
  constructor(appTree, private opts: Options) {
    super([appTree], {});
  }

  build() {
    this.buildAppJS();
    this.buildVendorJS();
  }

  private buildAppJS() {
    // todo: copy all addon's App Javascript into ourself

    // for the app tree, we take everything
    let specifiers = walkSync(this.inputPaths[0], {
      globs: ['**/*.js'],
      directories: false
    }).map(specifier => `../${specifier.replace(/\.js$/, '')}`);

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    let appJS = join(this.outputPath, this.opts.outputPath);
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({ specifiers }), 'utf8');
  }

  private buildVendorJS() {
    // todo: needs all active descendants
  }
}
