type filename = string;
type appRelativeURL = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build (the app that we hand off to a packager).
export interface AppMeta {
  'auto-upgraded'?: true;
  assets: filename[];
  babel: {
    filename: string;
    isParallelSafe: boolean;
    majorVersion: 6 | 7;
  };
  'root-url': string;
  'template-compiler': {
    filename: string;
    isParallelSafe: boolean;
  };
  version: 2;
}

// This describes the ember-specific parts of package.json of a v2-formatted
// addon.
export interface AddonMeta {
  'auto-upgraded'?: true;
  'app-js'?: filename;
  externals?: string[];
  'implicit-modules'?: string[];
  'implicit-scripts'?: filename[];
  'implicit-styles'?: filename[];
  'implicit-test-modules'?: string[];
  'implicit-test-scripts'?: filename[];
  'implicit-test-styles'?: filename[];
  'public-assets'?: {
    [filename: string]: appRelativeURL;
  };
  'renamed-modules'?: { [fromName: string]: string };
  version: 2;
}
