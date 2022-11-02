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
      targetExtension: 'js',
    });
  }

  processString(source: string, relativePath: string) {
    return hbsToJS(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
