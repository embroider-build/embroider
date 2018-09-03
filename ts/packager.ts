export interface Packager {
  new (
    pathToVanillaApp: string,
    outputPath: string,
    templateCompiler: (moduleName: string, templateContents: string) => string,
    consoleWrite: (message: string) => void,
  ): PackagerInstance;
}

export interface PackagerInstance {
  build(): Promise<void>;
}
