# Addon Author Guide

This document lays out the recommended best practices for addon authors who want their addons to work in apps built with Embroider.

## Give me the tl;dr: what should I do?

The best thing for all addons authors to do right now is to achieve the "Embroider Safe" support level. Follow the instructions in the [@embroider/test-setup README](https://github.com/embroider-build/embroider/tree/master/packages/test-setup) to add the `embroider-safe` scenario to your ember-try config.

## Beyond "Embroider Safe"

There are other levels of support beyond "Embroider Safe", but as long as you get that far you unblock the ability of your users to use Embroider. And the good news is that many addons are already Embroider Safe without doing any work, and all they really need to do is verify by adding a new scenario to their test suite.

As of this writing, we **do not** recommend trying to jump all the way to the "Embroider Native" format, because the shared tooling that will make it pleasant to work with native v2 addons is not really shipped yet. Examples of what I mean by "shared tooling" include:

- blueprints
- lints and analysis to check for patterns that aren't supported in v2
- a publishing command that makes it convenient to author your code in a format less verbose than the **v2** publication format.
- a shim library that makes your v2 addon function like a v1 addon in apps without Embroider

Adventurous souls are welcome to ignore this blocker if they want to be on the bleeding edge, but unless you're excited to participate in making and testing the tooling itself you might want to wait for more stable tools.

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

The best way to see if your addon is Embroider safe is to add the `@embroider/test-setup` package and runs its `embroider-safe` ember-try scenario. See its [README](https://github.com/embroider-build/embroider/tree/master/packages/test-setup) for full details.

If your tests _don't_ work under Embroider when you try this, please file an issue on the Embroider repo. We can help you triage whether there's a missing feature in `@embroider/compat` that would allow your addon to work unchanged, or whether there is a better way to refactor your addon to avoid incompatible behavior.

If your addon does work under Embroider, congrats! It is Embroider Safe. Please keep running the tests in your CI so you will notice if a future change to either Embroider or your addon breaks compatibility. You can also move on to trying to achieve the Optimized Embroider Safe support level.

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

An addon achieves the "Embroider Native" support level by publishing to NPM in the **v2 format**, as defined by [the RFC](https://github.com/emberjs/rfcs/pull/507). As of this writing, we **do not** recommend trying to jump all the way to the "Embroider Native" format, because the shared tooling that will make it pleasant to work with native v2 addons is not really shipped yet. Examples of what I mean by "shared tooling" include:

- blueprints
- lints and analysis to check for patterns that aren't supported in v2
- a publishing command that makes it convenient to author your code in a format less verbose than the **v2** publication format.
- a shim library that makes your v2 addon function like a v1 addon in apps without Embroider

Adventurous souls are welcome to ignore this blocker if they want to be on the bleeding edge, but unless you're excited to participate in making and testing the tooling itself you might want to wait for more stable tools.

Embroider doesn't care what format you use to _author_ your addon, it cares what format you publish to NPM. In **v1** apps there isn't a strong distinction between those two, which is convenient for addon authors but moves a large amount of complexity into every app's build.

For a simple addon, you might choose to author directly in **v2** format. The main limitations this imposes are:

- you get no preprocessors like TypesScript or Sass
- you can only use Javascript features that are part of the Ember Language Standard (see [the RFC](https://github.com/emberjs/rfcs/pull/507))
- you must explicitly link components and their co-located templates together via Ember's `setComponentTemplate`.

To avoid these limitations, you will want to have a build step that allows you to author more comfortably and compile to the **v2** format before publishing. We intend to ship shared tooling to help with this. Since many addons can already be compiled automatically from v1 to v2 by `@embroider/compat`, this tooling is likely to be pretty smart and you won't be obligated to refactor your whole addon, but there are a couple gotchas we will need to watch out for:

- When automatically upgrading addons to **v2**, `@embroider/compat` as used currently in Embroider deliberately allows some sloppiness that we won't allow from native **v2** addons. For example, native **v2** packages can't import from packages that aren't explicitly listed in their dependencies.
- When automatically upgrading addons to **v2**, `@embroider/compat` already has the full application available to examine, so any configuration-dependent transformations will run with the right configuration. For example, any polyfills that behave differently under different Ember versions will see the app's Ember version and do the right thing. But when publishing a native **v2** package, you _don't_ have that information available so if you want to emit different code for different Ember versions the polyfill needs to use `@embroider/macros`.

While it's important that we ship good shared tooling, a nice thing about having a stable **v2** format standard is that the community is free to experiment with alternative addon build tooling, and it won't impact compatibility or stability.

## Replacing the {{component}} helper

This section grew into its <a href="./REPLACING-COMPONENT-HELPER.md">own separate document</a>.
