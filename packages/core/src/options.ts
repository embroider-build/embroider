export default interface Options {
  /**
   * When true, we statically resolve all components, modifiers, and helpers (collectively
   * knows as Invokables) at build time. This causes any unused Invokables to be left out
   * of the build if they are unused i.e. "tree shaking".
   *
   * Defaults to false which gives you greater compatibility with classic Ember apps at the
   * cost of bigger builds.
   *
   * This setting takes over from `staticHelpers`, `staticModifiers`, and `staticComponents`
   * because the Developer Experience was less than ideal if any of these settings did not
   * agree i.e. they all needed to be true or they all needed to be false.
   *
   * Enabling this is a prerequisite for route splitting.
   */
  staticInvokables?: boolean;

  // Enables per-route code splitting. Any route names that match these patterns
  // will be split out of the initial app payload. If you use this, you must
  // also add @embroider/router to your app. See [@embroider/router's
  // README](https://github.com/embroider-build/embroider/blob/main/packages/router/README.md)
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
}

export type CoreOptionsType = Required<Options>;

export function optionsWithDefaults(options?: Options): CoreOptionsType {
  if ((options as any)?.staticHelpers !== undefined) {
    throw new Error(
      `You have set 'staticHelpers' on your Embroider options. This setting has been removed and replaced with 'staticInvokables'`
    );
  }

  if ((options as any)?.staticComponents !== undefined) {
    throw new Error(
      `You have set 'staticComponents' on your Embroider options. This setting has been removed and replaced with 'staticInvokables'`
    );
  }

  if ((options as any)?.staticModifiers !== undefined) {
    throw new Error(
      `You have set 'staticModifiers' on your Embroider options. This setting has been removed and replaced with 'staticInvokables'`
    );
  }

  let defaults = {
    staticInvokables: true,
    splitAtRoutes: [],
    staticAppPaths: [],
    pluginHints: [],
    amdCompatibility: 'cjs' as const,
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
