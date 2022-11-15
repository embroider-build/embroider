import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import make, { precompile, _buildCompileOptions, _print, _preprocess } from './babel-plugin-inline-hbs-deps';

export interface Params {
  templateCompiler: NodeTemplateCompilerParams;
}

export default make((opts: Params) => new NodeTemplateCompiler(opts.templateCompiler));
export { precompile, _buildCompileOptions, _print, _preprocess };
