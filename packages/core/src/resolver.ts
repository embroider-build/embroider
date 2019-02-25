import Options from './options';

export interface Resolution {
  type: "component" | "helper";
  modules: ({runtimeName: string, path: string})[];
}

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
