/*
  This plugin is used only for Ember < 3.27. For newer Ember's we have a
  different implementation that shares the standard
  babel-plugin-ember-template-compilation and supports passing Javascript
  lexically scoped names into templates.
*/

import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import make from './babel-plugin-inline-hbs';
import type * as Babel from '@babel/core';

export interface Params {
  templateCompiler: NodeTemplateCompilerParams;
}

export default make((opts: Params) => new NodeTemplateCompiler(opts.templateCompiler)) as (
  babel: typeof Babel
) => babel.PluginObj<unknown>;
