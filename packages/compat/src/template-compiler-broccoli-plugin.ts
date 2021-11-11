import type { Node } from 'broccoli-node-api';
import Filter from 'broccoli-persistent-filter';
import type { TemplateCompiler } from '@embroider/core';
import { join } from 'path';

export default class TemplateCompileTree extends Filter {
  constructor(inputTree: Node, private templateCompiler: TemplateCompiler) {
    super(inputTree, {
      name: `embroider-template-compile-stage1`,
      persist: true,
      extensions: ['hbs', 'handlebars'],
    });
  }

  processString(source: string, relativePath: string) {
    return this.templateCompiler.applyTransforms(relativePath, source);
  }
  cacheKeyProcessString(source: string, relativePath: string) {
    return `1-${this.templateCompiler.cacheKey}` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
