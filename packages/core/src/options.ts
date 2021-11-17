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

  // When true, we statically resolve all modifiers at build time. This
  // causes unused modifiers to be left out of the build ("tree shaking" of
  // modifiers).
  //
  // Defaults to false, which gives you greater compatibility with classic Ember
  // apps at the cost of bigger builds.
  //
  // Enabling this is a prerequisite for route splitting.
  staticModifiers?: boolean;

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

  // Every file within your application's `app` directory is categorized as a
  // component, helper, modifier, route, route template, controller, or "other".
  //
  // This option lets you decide which "other" files should be loaded
  // statically. By default, all "other" files will be included in the build and
  // registered with Ember's runtime loader, because we can't know if somebody
  // is going to try to access them dynamically via Ember's resolver or AMD
  // runtime `require`.
  //
  // If you know that your files are only ever imported, you can list them here
  // and then they will only be included exactly where they're needed.
  //
  // Provide a list of directories or files relative to `/app`. For example
  //
  //     staticAppPaths: ['lib']
  //
  // means that everything under your-project/app/lib will be loaded statically.
  //
  // This option has no effect on components (which are governed by
  // staticComponents), helpers (which are governed by staticHelpers), modifiers
  // (which are governed by staticModifiers) or the route-specific files (routes,
  // route templates, and controllers which are governed by splitAtRoutes).
  staticAppPaths?: string[];

  // By default, all modules that get imported into the app go through Babel, so
  // that all code will conform with your Babel targets. This option allows you
  // to turn Babel off for a particular package. You might need this to work
  // around a transpiler bug or you might use this as a build-performance
  // optimization if you've manually verified that a particular package doesn't
  // need transpilation to be safe in your target browsers.
  skipBabel?: { package: string; semverRange?: string }[];

  // This is a performance optimization that can help you avoid the "Your build
  // is slower because some babel plugins are non-serializable" penalty. If you
  // provide the locations of known non-serializable objects, we can discover
  // them and make them serializable.
  //
  // resolve is a list of paths to resolve, in a chain. This lets you resolve
  // your dependencies' dependencies, like: resolve: ['your-dependency',
  // 'inner-dependency/lib/transform']
  //
  // useMethod optionally lets you pick which property within the module to use.
  // If not provided, we use the module.exports itself.
  pluginHints?: { resolve: string[]; useMethod?: string }[];

  // Our addons' implicit-modules and implicit-test-modules are not necessarily
  // resolvable directly from the app, but the meaning of those
  // backward-compatibility features is "the app should import this module". So
  // we need some strategy for making them importable by the app. We can either
  // turn those imports into complete relative paths, or leave them as package
  // names:
  //
  // relativePaths:
  //
  //   import('./node_modules/intermediate/node_modules/some-addon/thing.js')
  //
  // packageNames:
  //
  //   import('some-addon/thing.js')
  //
  // When building under a tool like webpack, the relativePaths are safe and
  // always work, although they can be uglier to look at when debugging in
  // development.
  //
  // When building under a tool like snowpack, the package names can be easier
  // to work with because you already have web-bundles per package, and can't
  // necessarily address arbitrary places on the filesystem.
  //
  // Defaults to "relativePaths".
  implicitModulesStrategy?: 'packageNames' | 'relativePaths';
}

export function optionsWithDefaults(options?: Options): Required<Options> {
  let defaults = {
    staticHelpers: false,
    staticModifiers: false,
    staticComponents: false,
    packageRules: [],
    splitAtRoutes: [],
    splitControllers: false,
    splitRouteClasses: false,
    staticAppPaths: [],
    skipBabel: [],
    pluginHints: [],
    implicitModulesStrategy: 'relativePaths' as 'relativePaths',
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
