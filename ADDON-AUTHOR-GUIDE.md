# Addon Author Guide

This document lays out the recommended best practices for addon authors who want their addons to work in apps built with Embroider.

## Give me the tl;dr: what should I do?

The best thing for all addons authors to do right now is to achieve the "Embroider Safe" support level. See the section "Support Level: Embroider Safe" below to learn how.

There are other levels of support beyond "Embroider Safe", but as long as you get that far you unblock the ability of your users to use Embroider. And the good news is that many addons are already Embroider Safe without doing any work, and all they really need to do is verify by adding a new scenario to their test suite.

As of this writing, we **do not** recommend trying to jump all the way to the "Embroider Native" format, because:

1. The RFC defining it is not merged yet, so it could still change.
2. The shared tooling that will make it pleasant to work with native v2 addons is not really shipped yet. Examples of what I mean by "shared tooling" include:
   - blueprints
   - lints and analysis to check for patterns that aren't supported in v2
   - a publishing command that makes it convenient to author your code in a format less verbose than the **v2** publication format.
   - a shim library that makes your v2 addon function like a v1 addon in apps without Embroider

I expect the RFC to merge soon, and when it does that will remove the first blocker. At that point, adventurous souls are welcome to ignore the second blocker if they want to be on the bleeding edge, but unless you're excited to participate in making and testing the tooling itself you might want to wait for more stable tools.

## Big Picture

Embroider defines a new format for Ember Addons, which we call **v2 format**. We call the traditional format **v1 format**.

Under the hood, `@embroider/core` _only_ understands **v2** addons and that allows it to be simpler than the traditional build pipeline while doing more powerful static analysis.

But because we care a lot about backward and compatibility, we also have `@embroider/compat`: a layer that sits before `@embroider/core` that can compile _most_ **v1** addons to **v2**. It's "most" and not "all" because there are some things **v1** addons can do that are just too dynamic to bring forward into the more static format, or too locked-in to implementation details of the traditional build pipeline and its final output.

While we definitely want to move the whole addon ecosystem to **v2** format over time, there is no rush. As long as your addon can be understood by `@embroider/compat`, your addon won't block anyone from using Embroider.

We call addons that can be understood by `@embroider/compat` "Embroider Safe". "Embroider Safe" is the first of several different "support levels" an addon can achieve:

| Support level            | Format |
| ------------------------ | :----: |
| Embroider Safe           |   v1   |
| Optimized Embroider Safe |   v1   |
| Embroider Native         |   v2   |

## Support Level: Embroider Safe

Your addon may already be Embroider Safe! Many addons are. We've done a lot of work in the `@embroider/compat` package to be able to compile v1 addons on-the-fly into v2 addons.

The best way to see if your addon is Embroider safe is to add test coverage for using it under Embroider. You can configure your addon's dummy app and test suite under Embroider and then see if your tests still pass.

One way to do this is to follow the example of Ember Bootstrap. It has [code in ember-cli-build.js](https://github.com/kaliber5/ember-bootstrap/blob/b2ea3db27b2db7bae6e8d4c41e19f58b5ee2fbb6/ember-cli-build.js#L37-L49) to build its dummy app and test suite with Embroider if it detects Embroider packages in its dependencies, and it adds an [Ember Try Scenario](https://github.com/kaliber5/ember-bootstrap/blob/b2ea3db27b2db7bae6e8d4c41e19f58b5ee2fbb6/config/ember-try.js#L111-L122) that adds those dependencies.

If your tests _don't_ work under Embroider when you try this, please file an issue on the Embroider repo. We can help you triage whether there's a missing feature in `@embroider/compat` that would allow your addon to work unchanged, or whether there is a better way to refactor your addon to avoid incompatible behavior.

If your addon does work under Embroider, congrats! It is Embroider Safe. Please keep running the tests in your CI so you will notice if a future change to either Embroider or your addon breaks compatibility. You can also move on to trying to achieve the Optimized Embroider Safe support level.

## Support Level: Optimized Embroider Safe

Out of the box, Embroider runs with the maximum level of backward compatibility. Apps are encouraged to start there, and then once they have that working they can try to enable more optimizations (which really means _disabling_ some of the more heavy-handed backward compatibility systems in order to let the app be built more statically).

The Embroider README [explains what the options are and which order you should try to enable them](https://github.com/embroider-build/embroider/#options). This includes:

1. `staticAddonTrees` and `staticAddonTestSupportTrees` are relatively safe and easy. If these don't work, it's probably because you are consuming Javascript modules without importing them. If you can directly import them instead, you can probably enable these flags and keep your tests passing.
2. `staticHelpers` is also relatively safe. The way most code uses helpers in their templates tends to be statically analyzable.
3. `staticComponents` is harder, because addons tend to use the `{{component}}` helper, and Embroider cannot always statically tell what this means. App authors are able to work around this problem by adding `packageRules`,

You can follow these steps in your addon's dummy app to see if your tests continue to pass even under the higher levels of optimization. If you can get all the way to `staticComponents: true`, your addon is Optimized Embroider Safe.
