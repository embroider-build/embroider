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
  // bundle and loaded on demand. We will also generate an index.html file for
  // each one so that users entering on a split route get an appropriate script
  // tag without a second hit to the server.
  splitAtRoutes?: (RegExp | string)[];

  // When using splitAtRoutes, we always lazy load the template for each route,
  // and when combined with staticComponents and staticHelpers that means we
  // will lazy load the whole subgraph of templates, components, and helpers.
  //
  // Optionally, you can enable this flags to lazy-load the Controller and Route
  // files too.
  //
  // Turning this on allows more code to be lazily loaded, at the cost of
  // potentially breaking some legacy {{link-to}} behaviors that need a Route
  // and/or Controller to be present to merely generate a link to a route, even
  // before it has been clicked.
  //
  // This is probably safe if you don't use the `serialize` method on any Route.
  splitRouteClasses?: boolean;
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
