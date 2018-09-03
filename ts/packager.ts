export interface PackagerOptions {
  consoleWrite: (message: string) => void;
}

export interface Packager {
  new (pathToVanillaApp: string, outputPath: string, options: PackagerOptions): PackagerInstance;
}

export interface PackagerInstance {
  build(): Promise<void>;
}
