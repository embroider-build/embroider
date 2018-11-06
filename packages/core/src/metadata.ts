type filename = string;

// This describes the ember-specific parts of package.json of an app after the
// stage 2 build. This is the app that we hand off to a packager.
export interface AppPackageJSON {
  name: string;
  "ember-addon": {
    version: number;
    entrypoints: filename[];
    "template-compiler": filename;
    "babel-config": filename;
    externals: string[];
  };
}
