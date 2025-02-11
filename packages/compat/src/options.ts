import type { V1AddonConstructor } from './v1-addon';
import type { Options as CoreOptions } from '@embroider/core';
import { optionsWithDefaults as coreWithDefaults } from '@embroider/core';
import type { PackageRules } from './dependency-rules';

// These options control how hard we will try to achieve compatibility with v1
// addons. The defaults are conservative and try to maximize compatibility, at
// the cost of slower or bigger builds. As you eliminate sources of legacy
// behavior you can benefit from the more aggressive modes.
export default interface Options extends CoreOptions {
  // Allows you to override how specific addons will build. Like:
  //
  //   import V1Addon from '@embroider/compat'; let compatAdapters = new Map();
  //   compatAdapters.set('some-addon', class extends V1Addon {// do stuff here:
  //   see examples in ./compat-adapters
  //   });
  //
  // This should be understood as a temporary way to keep yourself from getting
  // stuck, not an alternative to actually fixing upstream. For the most part,
  // the real solution will be converting the addon in question to natively
  // publish as v2.
  //
  // We ship with some default compatAdapters to fix otherwise incompatible
  // behaviors in popular addons. You can override the default adapters by
  // setting your own value here (including null to completely disable it).
  compatAdapters?: Map<string, V1AddonConstructor | null>;

  // Allows you to tell Embroider about otherwise dynamic dependencies within
  // your app and addons that it can't figure out on its own. These are combined
  // with the default rules that ship with Embroider. Your own rules take
  // precedence over the built-ins. Order matters, first matching rule will
  // apply to any given addon.
  //
  // See the addon-dependency-rules directory in the @embroider/compat package
  // for the built-in rules.
  //
  // These ONLY APPLY to v1-formatted addons. An addon that ships as native v2
  // is expected to do the right thing on its own.
  //
  // Follow to the definition of PackageRules for more info.
  packageRules?: PackageRules[];

  // This turns build errors into runtime errors. It is not a good idea to keep
  // it on in production. But it can be helpful when testing how much of your
  // app is able to work with staticComponents enabled.
  allowUnsafeDynamicComponents?: boolean;

  // Allows you to customize the list of content types addons use to provide HTML
  // to {{content-for}}. By default, the following content types are expected:
  // 'head', 'test-head', 'head-footer', 'test-head-footer', 'body', 'test-body',
  // 'body-footer', 'test-body-footer'. You need to use this config only to extend
  // this list.
  availableContentForTypes?: string[];

  // Allows you to cancel the warning that at least one classic addon provides
  // content-for 'app-boot'. This warning brings awareness for developers
  // switching to Embroider, but is no longer necessary once content-for
  // 'app-boot' code has been properly moved to the app-side.
  useAddonAppBoot?: boolean;

  // content-for 'config-module'. This warning brings awareness for developers
  // switching to Embroider, but is no longer necessary once content-for
  // 'config-module' code has been properly moved to the app-side.
  useAddonConfigModule?: boolean;
}

const defaults = Object.assign(coreWithDefaults(), {
  staticAddonTrees: false,
  staticAddonTestSupportTrees: false,
  compatAdapters: new Map(),
  extraPublicTrees: [],
  workspaceDir: null,
  packageRules: [],
  allowUnsafeDynamicComponents: false,
  availableContentForTypes: [],
  useAddonAppBoot: true,
  useAddonConfigModule: true,
});

export type CompatOptionsType = Required<Options>;

export function optionsWithDefaults(options?: Options): CompatOptionsType {
  if (!(options as any)?.staticEmberSource) {
    console.log(
      `The setting 'staticEmberSource' will default to true in the next version of Embroider and can't be turned off. To prepare for this you should set 'staticEmberSource: true' in your Embroider config.`
    );
  }

  if ((options as any)?.staticEmberSource !== undefined) {
    if ((options as any).staticEmberSource === false) {
      throw new Error(
        `You have set 'staticEmberSource' to 'false' in your Embroider options. This option has been removed is always considered to have the value 'true'. Please remove this setting to continue.`
      );
    } else {
      console.log(
        `You have set 'staticEmberSource' in your Embroider options. This can safely be removed now and it defaults to true.`
      );
    }
  }

  if ((options as any)?.staticAddonTrees !== undefined) {
    if ((options as any).staticAddonTrees === false) {
      throw new Error(
        `You have set 'staticAddonTrees' to 'false' in your Embroider options. This option has been removed is always considered to have the value 'true'. Please remove this setting to continue.`
      );
    } else {
      console.log(
        `You have set 'staticAddonTrees' in your Embroider options. This can safely be removed now and it defaults to true.`
      );
    }
  }

  if ((options as any)?.staticAddonTestSupportTrees !== undefined) {
    if ((options as any).staticAddonTestSupportTrees === false) {
      throw new Error(
        `You have set 'staticAddonTestSupportTrees' to 'false' in your Embroider options. This option has been removed is always considered to have the value 'true'. Please remove this setting to continue.`
      );
    } else {
      console.log(
        `You have set 'staticAddonTestSupportTrees' in your Embroider options. This can safely be removed now and it defaults to true.`
      );
    }
  }

  if ((options as any)?.skipBabel !== undefined) {
    throw new Error(
      `You have set 'skipBabel' on your Embroider options. This setting has been removed and you can now configure your babel ignores directly in the babel config in your repo https://babeljs.io/docs/options#ignore`
    );
  }

  return Object.assign({}, defaults, options);
}

// These are recommended configurations for addons to test themselves under. By
// keeping them here, it's easier to do ecosystem-wide compatibility testing.
// See the `@embroider/test-setup` package which can help consume these to test
// them in CI.
export const recommendedOptions: { [name: string]: Options } = Object.freeze({
  safe: Object.freeze({}),
  optimized: Object.freeze({
    staticAddonTrees: true,
    staticAddonTestSupportTrees: true,
    allowUnsafeDynamicComponents: false,
    staticInvokables: true,
  }),
});
