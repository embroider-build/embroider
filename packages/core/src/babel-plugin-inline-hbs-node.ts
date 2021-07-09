import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import make from './babel-plugin-inline-hbs';
import type * as Babel from '@babel/core';

export interface Params {
  templateCompiler: NodeTemplateCompilerParams;
}

export default make((opts: Params) => new NodeTemplateCompiler(opts.templateCompiler)) as (
  babel: typeof Babel
) => babel.PluginObj<unknown>;
