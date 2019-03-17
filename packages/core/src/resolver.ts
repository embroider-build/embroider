export interface Resolver {
  astTransformer(): unknown;
  dependenciesOf(moduleName: string): { runtimeName: string, path: string }[];
}
