export default interface Options {
  // When true, we statically resolve all template helpers at build time. This
  // causes unused helpers to be left out of the build ("tree shaking" of
  // helpers).
  //
  // Defaults to false, which gives you greater compatibility with classic Ember
  // apps at the cost of bigger builds.
  //
  // Enabling this is a prerequisite for route splitting.
  staticHelpers?: boolean;

  // When true, we statically resolve all components at build time. This causes
  // unused components to be left out of the build ("tree shaking" of
  // components).
  //
  // Defaults to false, which gives you greater compatibility with classic Ember
  // apps at the cost of bigger builds.
  //
  // Enabling this is a prerequisite for route splitting.
  staticComponents?: boolean;

  // Enables per-route code splitting. Any route names that match these patterns
  // will be split out of the initial app payload. If you use this, you must
  // also add @embroider/router to your app. See [@embroider/router's
  // README](https://github.com/embroider-build/embroider/blob/master/packages/router/README.md)
  splitAtRoutes?: (RegExp | string)[];

  // By default, all modules that get imported into the app go through Babel, so
  // that all code will conform with your Babel targets. This option allows you
  // to turn Babel off for a particular package. You might need this to work
  // around a transpiler bug or you might use this as a build-performance
  // optimization if you've manually verified that a particular package doesn't
  // need transpilation to be safe in your target browsers.
  skipBabel?: { package: string; semverRange?: string }[];
}

export function optionsWithDefaults(options?: Options): Required<Options> {
  let defaults = {
    staticHelpers: false,
    staticComponents: false,
    packageRules: [],
    splitAtRoutes: [],
    splitControllers: false,
    splitRouteClasses: false,
    skipBabel: [],
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
