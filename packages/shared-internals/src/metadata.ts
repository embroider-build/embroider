type Filename = string;
type AppRelativeURL = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build (the app that we hand off to a packager).
export interface AppMeta {
  type: 'app';

  main?: string;
  'auto-upgraded'?: true;
  assets: Filename[];
  'root-url': string;
  version: 2;
}

// This describes the ember-specific parts of package.json of a v2-formatted
// addon.
export interface AddonMeta {
  type: 'addon';
  main?: string;
  'order-index'?: number;
  'lazy-engine'?: boolean;

  'auto-upgraded'?: true;
  'app-js'?: { [appName: string]: Filename };
  'fastboot-js'?: { [appName: string]: Filename };
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

export interface PackageInfo {
  keywords?: string[];
  name: string;
  version: string;
  main?: string;
  module?: string;
  exports?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  'ember-addon':
    | AddonMeta
    | AppMeta
    | {
        main?: string;
        //
        version?: 1;
        type?: 'addon' | 'app';
        paths?: string[];
        before?: string | string[];
        after?: string | string[];
      };
}
