type filename = string;
type appRelativeURL = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build (the app that we hand off to a packager).
export interface AppMeta {
  version: 2;
  assets: filename[];
  externals?: string[];
  "template-compiler": filename;
  "babel-config": filename;
}

// This describes the ember-specific parts of package.json of a v2-formatted
// addon.
export interface AddonMeta {
  version: 2;
  externals?: string[];
  'public-assets'?: {
    [filename: string]: appRelativeURL;
  };
  "implicit-scripts"?: filename[];
  "implicit-test-scripts"?: filename[];
  "implicit-styles"?: filename[];
  "implicit-test-styles"?: filename[];
  "implicit-modules"?: string[];
  "implicit-test-modules"?: string[];
  "renamed-modules"?: { [fromName: string]: string };
  "app-js"?: filename;
  "auto-upgraded"?: true;
}
