export interface Packager {
  new (
    pathToVanillaApp: string,
    outputPath: string,
    consoleWrite: (message: string) => void,
  ): PackagerInstance;
}

export interface PackagerInstance {
  build(): Promise<void>;
}
