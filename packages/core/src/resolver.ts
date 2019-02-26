import Options from './options';

interface ResolutionResult {
  type: "component" | "helper";
  modules: ({runtimeName: string, path: string})[];
}

interface ResolutionFail {
  type: "error";
  hardFail: boolean;
  message: string;
}

export type Resolution = ResolutionResult | ResolutionFail;

export interface ResolverInstance {
  resolveSubExpression(path: string, from: string): Resolution | null;
  resolveMustache(path: string, from: string): Resolution | null;
  resolveElement(tagName: string, from: string): Resolution | null;
}

export interface ResolverParams {
  root: string;
  modulePrefix: string;
  options: Required<Options>;
}

export interface Resolver {
  new (params: ResolverParams): ResolverInstance;
}
