import { Resolver } from './resolver';
import { join } from 'path';
import { PluginItem, transform } from '@babel/core';
import type { Params as InlineBabelParams } from './babel-plugin-inline-hbs';
import { Plugins } from './ember-template-compiler-types';
import { getEmberExports } from './load-ember-template-compiler';
import { TemplateCompiler } from './template-compiler-common';
import adjustImportsPlugin from './babel-plugin-adjust-imports';

export interface NodeTemplateCompilerParams {
  compilerPath: string;
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

  compile(moduleName: string, contents: string) {
    let src = super.compile(moduleName, contents);
    let resolver = this.params.resolver;
    if (resolver) {
      return transform(src, {
        filename: moduleName,
        generatorOpts: {
          compact: false,
        },
        plugins: [[adjustImportsPlugin, resolver.adjustImportsOptions]],
      })!.code!;
    } else {
      return src;
    }
  }

  // Use applyTransforms on the contents of inline hbs template strings inside
  // Javascript.
  inlineTransformsBabelPlugin(): PluginItem {
    return [
      join(__dirname, 'babel-plugin-inline-hbs-node.js'),
      {
        templateCompiler: this.params,
        stage: 1,
      } as InlineBabelParams,
    ];
  }

  baseDir() {
    return join(__dirname, '..');
  }
}
