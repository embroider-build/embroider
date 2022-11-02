import { Resolver } from './resolver';
import { join } from 'path';
import { PluginItem } from '@babel/core';
import { Plugins } from './ember-template-compiler-types';
import { getEmberExports } from './load-ember-template-compiler';
import { TemplateCompiler } from './template-compiler-common';
import { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';

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
    let opts: EtcOptions = {
      compilerPath: this.params.compilerPath,
      targetFormat: 'hbs',
      enableLegacyModules: ['ember-cli-htmlbars', 'ember-cli-htmlbars-inline-precompile', 'htmlbars-inline-precompile'],
      transforms: this.params.plugins.ast as any,
    };
    return [require.resolve('babel-plugin-ember-template-compilation'), opts];
  }

  baseDir() {
    return join(__dirname, '..');
  }
}
