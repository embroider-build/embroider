import type { Node } from 'broccoli-node-api';
import Filter from 'broccoli-persistent-filter';
import { hbsToJS } from '@embroider/core';
import { join } from 'path';

export default class TemplateCompileTree extends Filter {
  constructor(inputTree: Node) {
    super(inputTree, {
      name: `embroider-template-compile-stage1`,
      persist: true,
      extensions: ['hbs', 'handlebars'],
    });
  }

  getDestFilePath(relativePath: string, entry: Parameters<Filter['getDestFilePath']>[1]) {
    if (this.isDirectory(relativePath, entry)) {
      return null;
    }
    for (let ext of ['hbs', 'handlebars']) {
      if (relativePath.slice(-ext.length - 1) === '.' + ext) {
        // we deliberately don't chop off the .hbs before appending .js, because if
        // the user has both .js` and .hbs` side-by-side we don't want our new file
        // to collide with theirs.
        return relativePath + '.js';
      }
    }
    return null;
  }

  processString(source: string, relativePath: string) {
    return hbsToJS(source, { filename: relativePath });
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
