type Filename = string;
type AppRelativeURL = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build (the app that we hand off to a packager).
export interface AppMeta {
  type: 'app';

  'auto-upgraded'?: true;
  assets: Filename[];
  babel: {
    filename: string;
    isParallelSafe: boolean;
    majorVersion: 7;
    fileFilter: string;
  };
  'resolvable-extensions': string[];
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
  type: 'addon';
  'order-index'?: number;
  'lazy-engine'?: boolean;

  'auto-upgraded'?: true;
  'app-js'?: { [appName: string]: Filename };
  'fastboot-js'?: { [appName: string]: Filename };
  externals?: string[];
  'implicit-modules'?: string[];
  'implicit-scripts'?: Filename[];
  'implicit-styles'?: Filename[];
  'implicit-test-modules'?: string[];
  'implicit-test-scripts'?: Filename[];
  'implicit-test-styles'?: Filename[];
  'public-assets'?: {
    [filename: string]: AppRelativeURL;
  };
  'renamed-packages'?: { [fromName: string]: string };
  'renamed-modules'?: { [fromName: string]: string };
  version: 2;
}
