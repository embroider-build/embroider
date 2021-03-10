import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import make, { Params as CoreParams } from './babel-plugin-inline-hbs';

export interface Params extends CoreParams {
  templateCompiler: NodeTemplateCompilerParams;
}

export default make((opts: Params) => new NodeTemplateCompiler(opts.templateCompiler));
