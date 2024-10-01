interface UnknownModule {
  [exportName: string]: unknown;
}

declare const compatModules: Record<string, UnknownModule>;

export default compatModules;
