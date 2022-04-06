# Addon Author Guide

This document lays out the recommended best practices for addon authors who want their addons to work in apps built with Embroider.

## Give me the tl;dr: what should I do?

The best thing for all addons authors to do right now is to achieve the "Embroider Safe" support level. Follow the instructions in the [@embroider/test-setup README](https://github.com/embroider-build/embroider/tree/main/packages/test-setup) to add the `embroider-safe` scenario to your ember-try config.

There are other levels of support beyond "Embroider Safe", but as long as you get that far you unblock the ability of your users to use Embroider. And the good news is that many addons are already Embroider Safe without doing any work, and all they really need to do is verify by adding a new scenario to their test suite.

## Big Picture

Embroider defines a new format for Ember Addons, which we call **v2 format**. We call the traditional format **v1 format**.

Under the hood, `@embroider/core` _only_ understands **v2** addons and that allows it to be simpler than the traditional build pipeline while doing more powerful static analysis.

But because we care a lot about backward compatibility, we also have `@embroider/compat`: a layer that sits before `@embroider/core` that can compile _most_ **v1** addons to **v2**. It's "most" and not "all" because there are some things **v1** addons can do that are just too dynamic to bring forward into the more static format, or too locked-in to implementation details of the traditional build pipeline and its final output.

While we definitely want to move the whole addon ecosystem to **v2** format over time, there is no rush. As long as your addon can be understood by `@embroider/compat`, your addon won't block anyone from using Embroider.

We call addons that can be understood by `@embroider/compat` "Embroider Safe". "Embroider Safe" is the first of several different "support levels" an addon can achieve:

| Support level            | Format |
| ------------------------ | :----: |
| Embroider Safe           |   v1   |
| Optimized Embroider Safe |   v1   |
| Embroider Native         |   v2   |

## Support Level: Embroider Safe

Your addon may already be Embroider Safe! Many addons are. We've done a lot of work in the `@embroider/compat` package to be able to compile v1 addons on-the-fly into v2 addons.

The best way to see if your addon is Embroider safe is to add the `@embroider/test-setup` package and runs its `embroider-safe` ember-try scenario. See its [README](https://github.com/embroider-build/embroider/tree/main/packages/test-setup) for full details.

If your tests _don't_ work under Embroider when you try this, please file an issue on the Embroider repo. We can help you triage whether there's a missing feature in `@embroider/compat` that would allow your addon to work unchanged, or whether there is a better way to refactor your addon to avoid incompatible behavior.

If your addon does work under Embroider, congrats! It is Embroider Safe. Please keep running the tests in your CI so you will notice if a future change to either Embroider or your addon breaks compatibility. You can also move on to achieving the Optimized Embroider Safe support level.

## Support Level: Optimized Embroider Safe

Out of the box, Embroider runs with the maximum level of backward compatibility. Apps are encouraged to start there, and then once they have that working they can try to enable more optimizations (which really means _disabling_ some of the more heavy-handed backward compatibility systems in order to let the app be built more statically).

The Embroider README [explains what the options are and which order you should try to enable them](https://github.com/embroider-build/embroider/#options). This includes:

1. `staticAddonTrees` and `staticAddonTestSupportTrees` are relatively safe and easy. If these don't work, it's probably because you are consuming Javascript modules without importing them. If you can directly import them instead, you can probably enable these flags and keep your tests passing.
2. `staticHelpers` is also relatively safe. The way most code uses helpers in their templates tends to be statically analyzable.
3. `staticComponents` is harder, because addons tend to use the `{{component}}` helper frequently, and Embroider cannot always statically tell what this means. App authors are able to work around this problem by adding `packageRules`, but addons should actually solve the problem directly by making their code statically understandable. See "Replacing the {{component}} helper" below.

You can follow these steps in your addon's dummy app to see if your tests continue to pass even under the higher levels of optimization. If you can get all the way to `staticComponents: true`, your addon is achieves the Optimized Embroider Safe support level.

You don't need to try to test the `splitAtRoutes` option within your addon -- as long as you reach `staticComponents` your addon will work fine in apps that want to use `splitAtRoutes`.

Once you achieve Optimized Embroider Safe, you should enable the `embroider-optimized` ember-try scenario provided by `@embroider/test-setup` to ensure you don't regress. It's a good idea to also continue testing the `embroider-safe` scenario too, because some common bugs can actually get optimized away under `embroider-optimized` that will break under `embroider-safe`.

## Support Level: Embroider Native

An addon achieves the "Embroider Native" support level by publishing to NPM in the **v2 format**, as defined by [the RFC](https://github.com/emberjs/rfcs/pull/507).

For full details on porting an addon to V2, see [the V2 porting guide](https://github.com/embroider-build/embroider/blob/main/PORTING-ADDONS-TO-V2.md)

Another good way to learn about V2 addons is to look at some examples:

- [ember-welcome-page](https://github.com/ember-cli/ember-welcome-page)
- [ember-resources](https://github.com/NullVoxPopuli/ember-resources)
- [ember-stargate](https://github.com/kaliber5/ember-stargate)
- [glimmer-apollo](https://github.com/josemarluedke/glimmer-apollo)

Several of these examples use a monorepo as a way to keep a clean separation between the addon and the application that holds their test suite. If you're comfortable working with monorepos this is a good solution. On the other hand, monorepos have some tradeoffs and are not always well-supported by all tools, so it's also OK to keep your test app in a subdirectory of your addon. This is closer to how V1 addons work, where `tests/dummy` serves this purpose. See [ember-welcome-page](https://github.com/ember-cli/ember-welcome-page) for an example of not using a monorepo -- instead it has a `test-app` subdirectory and uses the `addon-dev` command from `@embroider/addon-dev` to manage linkage between the addon and the test-app and to manage combining of dependencies from both into a single top-level package.json

We support some tools to make V2 addon development more convenient:

- [@embroider/addon-shim](https://github.com/embroider-build/embroider/blob/main/packages/addon-shim/README.md) makes your V2 addon understandable to ember-cli. All V2 addons should use this.
- [@embroider/addon-dev](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/README.md) is an optional `devDependency` for your addon that provides build tooling. This gives you more flexibility over how you author your addon (like taking advantage of automatic template-colocation or using TypeScript) while still producing a spec-compliant package for publication to NPM.

## Replacing the {{component}} helper

This section grew into its <a href="./REPLACING-COMPONENT-HELPER.md">own separate document</a>.
