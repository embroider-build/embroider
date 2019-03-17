import TemplateCompiler from "./template-compiler";

export interface Resolver {
  astTransformer(templateCompiler: TemplateCompiler): unknown;
  dependenciesOf(moduleName: string): { runtimeName: string, path: string }[];
}
