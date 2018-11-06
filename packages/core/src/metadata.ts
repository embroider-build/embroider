type filename = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build. This is the app that we hand off to a packager.
export interface AppPackageJSON {
  name: string;
  "ember-addon": {
    version: 2;
    entrypoints: filename[];
    externals?: string[];
    "template-compiler": filename;
    "babel-config": filename;
  };
}

// This describes the ember-specific parts of package.json of a v2-formatted
// addon.
export interface AddonPackageJSON {
  name: string;
  "ember-addon": {
    version: 2;
    externals?: string[];
    "implicit-scripts"?: filename[];
    "implicit-test-scripts"?: filename[];
    "implicit-styles"?: filename[];
    "implicit-test-styles"?: filename[];
    "implicit-modules"?: filename[];
    "renamed-modules"?: { [fromName: string]: string };
    "app-js"?: filename;
  };
}
