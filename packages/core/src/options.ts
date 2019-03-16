import { PackageRules } from "./dependency-rules";

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
}

export function optionsWithDefaults(options?: Options): Required<Options> {
  let defaults = {
    staticHelpers: false,
    staticComponents: false,
    packageRules: [],
  };
  if (options) {
    return Object.assign(defaults, options);
  }
  return defaults;
}
