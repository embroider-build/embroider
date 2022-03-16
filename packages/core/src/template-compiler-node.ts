import { Resolver } from './resolver';
import { join } from 'path';
import { PluginItem } from '@babel/core';
import type { Params as InlineBabelParams } from './babel-plugin-stage1-inline-hbs-node';
import { Plugins } from './ember-template-compiler-types';
import { getEmberExports } from './load-ember-template-compiler';
import { TemplateCompiler } from './template-compiler-common';

export interface NodeTemplateCompilerParams {
  compilerPath: string;
  compilerChecksum: string;
  resolver?: Resolver;
  EmberENV: unknown;
  plugins: Plugins;
}

export class NodeTemplateCompiler extends TemplateCompiler {
  constructor(public params: NodeTemplateCompilerParams) {
    super({
      loadEmberTemplateCompiler: () => getEmberExports(params.compilerPath),
      resolver: params.resolver,
      EmberENV: params.EmberENV,
      plugins: params.plugins,
    });
  }

  // Use applyTransforms on the contents of inline hbs template strings inside
  // Javascript.
  inlineTransformsBabelPlugin(): PluginItem {
    return [
      join(__dirname, 'babel-plugin-stage1-inline-hbs-node.js'),
      {
        templateCompiler: this.params,
      } as InlineBabelParams,
    ];
  }

  baseDir() {
    return join(__dirname, '..');
  }
}
