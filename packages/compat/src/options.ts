import { V1AddonConstructor } from "./v1-addon";
import { Tree } from "broccoli-plugin";

// These options control how hard we will try to achieve compatibility with v1
// addons. The defaults are conservative and try to maximize compatibility, at
// the cost of slower or bigger builds. As you eliminate sources of legacy
// behavior you can benefit from the more aggressive modes.
export default interface Options {

  // Whether to force the contents of each v1 addon's treeForAddon (the "Own
  // Javascript" as described in SPEC.md) to be incorporated into the build.
  //
  //   true (the default): implies maximum backward compatibility at the cost of
  //   bigger builds.
  //
  //   false: produces smaller builds. The addon files must be imported from
  //   somewhere we can statically see during the build.
  //
  // Commentary: most v1 addons already work well with this set to true, because
  // they tend to either offer Javascript that users are supposed to directly
  // `import` or components / helpers / services that get directly imported and
  // re-exported by code in App Javascript. The exceptions are addons that do
  // runtime shenanigans with `require` or scoped runtime resolutions.
  //
  // To workaround an addon that is preventing you from enabling this flag, you
  // can add a compatAdapter that uses forceIncludeModule. Look at examples in
  // ./compat-adapters.
  forceIncludeAddonTrees?: boolean;

  // Whether to force the contents of each v1 addon's treeForTestSupport to be
  // incorporated into test builds.
  //
  //   true (the default): implies maximum backward compatibility at the cost of
  //   bigger builds.
  //
  //   false: produces smaller builds. The files must be imported from somewhere
  //   we can statically see during the build.
  //
  // Commentary: this is analogous to forceIncludeAddonTrees and the same
  // guidelines applies.
  forceIncludeAddonTestSupportTrees?: boolean;

  // Allows you to override how specific addons will build. Like:
  //
  //   import V1Addon from '@embroider/compat';
  //   let compatAdapters = new Map();
  //   compatAdapters.set('some-addon', class extends V1Addon {
  //     // do stuff here: see examples in ./compat-adapters
  //   });
  //
  // This should be understood as a temporary way to keep yourself from getting
  // stuck, not an alternative to actually fixing upstream. For the most part,
  // the real solution will be converting the addon in question to natively
  // publish as v2.
  //
  // We ship with some default compatAdapters to fix otherwise incompatible
  // behaviors in popular addons.
  compatAdapters?: Map<string, V1AddonConstructor>;

  // temporary directory where we will work when we're rewriting your addons
  // and/or app to v2-compatible formats.
  workspaceDir?: string | null;

  // optional list of additional broccoli trees that should be incorporated into
  // the final build. This exists because the classic `app.toTree()` method
  // accepts an optional tree argument that has the same purpose.
  extraPublicTrees?: Tree[];

}

export type OptionsWithDefaults = Required<Options>;

export function optionsWithDefaults(options: Options | undefined): OptionsWithDefaults {
  let defaults: OptionsWithDefaults = {
    forceIncludeAddonTrees: true,
    forceIncludeAddonTestSupportTrees: true,
    compatAdapters: new Map(),
    extraPublicTrees: [],
    workspaceDir: null
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
