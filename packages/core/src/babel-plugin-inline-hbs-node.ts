import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import make from './babel-plugin-inline-hbs';

export interface Params {
  templateCompiler: NodeTemplateCompilerParams;
}

export default make((opts: Params) => new NodeTemplateCompiler(opts.templateCompiler));
