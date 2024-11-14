declare module '@embroider/virtual/compat-modules' {
  interface UnknownModule {
    [exportName: string]: unknown;
  }

  const compatModules: Record<string, UnknownModule>;

  export default compatModules;
}
