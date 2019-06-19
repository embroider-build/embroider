export interface Packager<Options> {
  new (
    // where on disk the packager will find the app it's supposed to build. The
    // app and its addons will necessarily already be in v2 format, which is
    // what makes a Packager a cleanly separable stage that needs only a small
    // amount of ember-specific knowledge.
    inputPath: string,
    // where the packager should write the packaged app.
    outputPath: string,
    // if possible, the packager should direct its console output through this
    // hook.
    consoleWrite: (message: string) => void,
    // A packager can have whatever custom options type it wants here. If the
    // packager is based on a third-party tool, this is where that tool's
    // configuration can go.
    options?: Options
  ): PackagerInstance;

  // a description for this packager that aids debugging & profiling
  annotation: string;
}

export interface PackagerInstance {
  build(): Promise<void>;
}
