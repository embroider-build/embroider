export interface Resolution {
  type: "component" | "helper";
  modules: ({runtimeName: string, path: string})[];
}

export interface ResolverInstance {
  resolveMustache(path: string, from: string): Resolution | null;
  resolveElement(tagName: string): Resolution | null;
}

export interface Resolver {
  new (params: { root: string, modulePrefix: string }): ResolverInstance;
}
