export default interface Options {
  /**
   * When true, we statically resolve all template helpers at build time. This
   * causes unused helpers to be left out of the build ("tree shaking" of
   * helpers).
   *
   * Defaults to false, which gives you greater compatibility with classic Ember
   * apps at the cost of bigger builds.
   *
   * Enabling this is a prerequisite for route splitting.
   *
   * @deprecated use staticInvokables instead
   */
  staticHelpers?: boolean;

  /**
   * When true, we statically resolve all modifiers at build time. This
   * causes unused modifiers to be left out of the build ("tree shaking" of
   * modifiers).
   *
   * Defaults to false, which gives you greater compatibility with classic Ember
   * apps at the cost of bigger builds.
   *
   * Enabling this is a prerequisite for route splitting.
   *
   * @deprecated use staticInvokables instead
   */
  staticModifiers?: boolean;

  /**
   * When true, we statically resolve all components at build time. This causes
   * unused components to be left out of the build ("tree shaking" of
   * components).
   *
   * Defaults to false, which gives you greater compatibility with classic Ember
   * apps at the cost of bigger builds.
   *
   * Enabling this is a prerequisite for route splitting.
   *
   * @deprecated use staticInvokables instead
   */
  staticComponents?: boolean;

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

  // Ember classically used a runtime AMD module loader.
  //
  // Embroider *can* locate the vast majority of modules statically, but when an
  // addon is doing something highly dynamic (like injecting AMD `define()`
  // statements directly into a <script>), we still may not be able to locate
  // them. So Embroider can emit a placeholder shim for the missing module that
  // attempts to locate it at runtime in the classic AMD loader.
  //
  // This shim can be generated as commonJS (cjs) or an ES module (es). The
  // default is cjs.
  //
  // CJS is useful when you're building in an environment that is tolerant of
  // mixed CJS and ES modules (like Webpack), because the set of exported names
  // from the module doesn't need to be known in advance. For this reason, CJS
  // shims are generated on-demand and are fully-automatic. This is the default
  // for maximum backward-compatibility.
  //
  // ES is useful when you're building in a strict ES module environment (like
  // Vite). It's fully spec-defined and doesn't suffer interoperability
  // complexities. The downside is, we can only emit a correct shim for a module
  // if you tell embroider what set of names it exports. Example:

  // emberExternals: {
  //   es: [
  //     // import { first, second  } from "my-library";
  //     ['my-library', ['first', 'second']],
  //     // import Example from "my-library/components/example";
  //     ['my-library/components/example', ['default']]
  //   ];
  // }

  // It is not recommended to use `es` mode without also using
  // staticEmberSource, because without staticEmberSource ember itself needs
  // many external shims.
  //
  // false means we don't do any external shimming.
  amdCompatibility?:
    | false
    | 'cjs'
    | {
        es: [string, string[]][];
      };
}

export type CoreOptionsType = Required<
  Omit<Options, 'staticHelpers' | 'staticModifiers' | 'staticComponents' | 'staticInvokables'>
> &
  Pick<Options, 'staticHelpers' | 'staticModifiers' | 'staticComponents' | 'staticInvokables'>;

export function optionsWithDefaults(options?: Options): CoreOptionsType {
  let defaults = {
    splitAtRoutes: [],
    staticAppPaths: [],
    skipBabel: [],
    pluginHints: [],
    amdCompatibility: 'cjs' as const,
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
