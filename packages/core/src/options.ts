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

  // Any route names that match these patterns will be split out of the main
  // bundle and loaded on demand.
  splitAtRoutes?: (RegExp | string)[];
}

export function optionsWithDefaults(options?: Options): Required<Options> {
  let defaults = {
    staticHelpers: false,
    staticComponents: false,
    packageRules: [],
    splitAtRoutes: [],
    splitControllers: false,
    splitRouteClasses: false,
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
