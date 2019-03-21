import TemplateCompiler from './template-compiler';

export interface ResolvedDep {
  runtimeName: string;
  path: string;
  absPath: string;
}

export interface Resolver {
  astTransformer(templateCompiler: TemplateCompiler): unknown;
  dependenciesOf(moduleName: string): ResolvedDep[];
}
