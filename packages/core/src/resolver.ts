import { TemplateCompiler } from './template-compiler-common';
import { Options } from './babel-plugin-adjust-imports';

export interface ResolvedDep {
  runtimeName: string;
  path: string;
  absPath: string;
}

export interface Resolver {
  astTransformer(templateCompiler: TemplateCompiler): unknown;
  dependenciesOf(moduleName: string): ResolvedDep[];

  // this takes an absolute path to a file and gives back a path like
  // "the-package-name/path/to/the-file.js", while taking into account any
  // backward-compatible runtime name of the package. It's used by the template
  // compiler, because this is the kind of path AST plugins expect to see.
  absPathToRuntimePath(absPath: string): string;

  // this takes an absolute path to a file and gives back the runtime name of
  // that module, as it would tradtionally be named within loader.js.
  absPathToRuntimeName(absPath: string): string;

  adjustImportsOptions: Options;
}
