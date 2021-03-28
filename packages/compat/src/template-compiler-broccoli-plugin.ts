import type { Node } from 'broccoli-node-api';
import Filter from 'broccoli-persistent-filter';
import type { TemplateCompiler } from '@embroider/core';
import { join } from 'path';

export default class TemplateCompileTree extends Filter {
  constructor(inputTree: Node, private templateCompiler: TemplateCompiler, private stage: 1 | 3) {
    super(inputTree, {
      name: `embroider-template-compile-stage${stage}`,
      persist: true,
      extensions: ['hbs', 'handlebars'],
      // in stage3 we are changing the file extensions from hbs to js. In
      // stage1, we are just keeping hbs.
      targetExtension: stage === 3 ? 'js' : undefined,
    });
  }

  processString(source: string, relativePath: string) {
    if (this.stage === 1) {
      return this.templateCompiler.applyTransforms(relativePath, source);
    } else {
      return this.templateCompiler.compile(relativePath, source);
    }
  }
  cacheKeyProcessString(source: string, relativePath: string) {
    return `${this.stage}-${this.templateCompiler.cacheKey}` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
