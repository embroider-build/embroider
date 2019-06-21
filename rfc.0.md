- Start Date: 2019-06-21
- Relevant Team(s): Ember CLI, Ember.js, Learning
- RFC PR:
- Tracking:

# v2 Package Format (Embroider Compatibility)

## Summary

This RFC defines a new package format that is designed to make all Ember packages (which includes both Addons and Apps) statically analyzable and more compatible with the rest of the NPM & Javascript ecosystem.

## Motivation

One of the good things about Ember is that apps and addons have a powerful set of build-time capabilities that allow lots of shared code with zero-to-no manual integration steps for the typical user. We have been doing “zero config” since before it was a cool buzzword (it was just called “convention over configuration”). And we’ve been broadly successful at maintaining very wide backward- and forward-compatibility for a large body of highly-rated community-maintained addons.

But one of the challenging things about Ember is that our ecosystem’s build-time capabilities are more implementation-defined than spec-defined, and the implementation has accumulated capabilities organically while only rarely phasing out older patterns. I believe the lack of a clear, foundational, build-time public API specification is the fundamental underlying issue that efforts like the various packaging / packager RFCs have tried to work around.

The benefits to users for this RFC are:

- faster builds and faster NPM installs
- “zero-config import from NPM — both static and dynamic” as a first-class feature all apps and addons can rely on.
- tree-shaking of app- and addon-provided modules, components, helpers, etc.
- a more approachable build system that enables more people to contribute and better integration with other JS toolchains.

## Key Ideas

### Fully Embrace ES Modules

Ember was one of the earliest adopters of ECMAScript modules, and Ember core team members were directly involved in helping move that features through TC39. Ember’s early experiences with modules influenced the spec itself. _Yet we have lagged in truly embracing modules._

For example, how do Ember apps express that they depend on a third-party library? The [app.import](https://ember-cli.com/user-guide/#javascript-assets) API. This should be ECMA standard `import`.

Another way to state the problem is that apps and addons all _push_ whatever code they want into the final built app. Whereas ES modules can _pull_ each other into the build as needed.

### Play nice with NPM Conventions

The ECMA module spec by itself doesn’t try to define a module resolution algorithm. But the overwhelmingly most popular convention is the [node_modules resolution algorithm](https://nodejs.org/api/all.html#modules_all_together).

Ember addons do respect node_module resolution for build-time code, but they do not respect it for runtime code. This is an unhelpful distinction.

### Verbose, Static Javascript as a Compiler Target

Ember’s strong conventions mean that many kinds of dependencies can be inferred (including _statically_ inferred) without requiring the developer to laboriously manage them. This is a good thing and I believe the current fad in the wider Javascript ecosystem for making developers hand-write verbose static imports for everything confuses the benefits of having static analysis (which is good) with the benefits of hand-managing those static imports (which is unnecessary cognitive load when you have clear conventions and a compiler).

This design is about compiling today’s idiomatic Ember code into more “vanilla” patterns that leverage ES modules, node_modules resolution, and spec-compliant static and dynamic `import` to express the structure of an Ember application in a much more “vanilla Javascript” way.

This compile step lets us separate the authoring format (which isn’t changing in any significant way in this RFC) from the packaging format (which can be more verbose and static than we would want in an authoring format).

# Detailed design

## Definitions

**package**: every addon and app is a package. Usually synonymous with “NPM package”, but we also include in-repo packages. The most important fact about a package is that it’s often the boundary around code that comes from a particular author, team, or organization, so coordination across packages is a more sensitive design problem than coordination within apps.

**app**: a package used at the root of a project.

**addon**: a package not used at the root of a project. Will be an **allowed dependency** of either an **app** or an **addon**.

**allowed dependency**: For **addons**, the **allowed dependencies** are the `dependencies` and `peerDependencies` in `package.json` plus any in-repo addons. For **apps**, the **allowed dependencies** are the `dependencies`, `peerDependencies`, and `devDependencies` in `package.json` plus any in-repo addons.

**Ember package metadata**: the `ember-addon` section inside `package.json`. This already exists in v1, we’re going to extend it.

**v2 package**: a package with `package.json` like:

    "keywords": [ "ember-addon" ],
    "ember-addon": {
      "version": 2
    }

**v1 package**: a package with `package.json` like:

    "keywords": [ "ember-addon" ]

and no `version` key (or version key less than 2) in **Ember package metadata**.

**non-Ember package**: a package without `keywords: ["ember-addon"]`

## Scope of this RFC

This is intended as the base level spec for v2 packages. **It does not attempt to cover everything a v1 package can do today**. For example, no provision is made in this RFC for:

- providing dev middleware
- providing commands and blueprints
- preprocessing your parent package's code
- modifying your parent package's babel config
- injecting content into index.html

It is understood that all of these are legitimate things for Ember addons to do. Defining these capabilities within v2 packages will be done in followup RFCs. It is simply too much scope to cover in one RFC.

Because we're hyper-focused on backward- and forward-compatibility, there is no harm in progressively converting some addons to v2 (which provides immediate benefits) while others need to stay as v1 until we offer the features they need.

Splitting up into multiple RFCs also increases the likelihood that we can parallelize some of the effort.

## Package Public API Overview

The structure we are about to describe _is a publication format_. Not necessarily an authoring format. By separating the two, we make it easier to evolve the authoring formats without breaking ecosystem-wide compatibility. The publication format is deliberately more explicit and less dynamic that what we may want for an authoring format.

First, here’s the list of things a v2 package can provide. More detail on each of these will follow:

- **Own Javascript**: javascript and templates under the package’s own namespace (the v1 equivalent is `/addon/**/*.js/`)
- **App Javascript**: javascript and templates that must be merged with the consuming app’s namespace (the v1 equivalent is `/app/**/*.js`). Other RFCs are working to move Ember away from needing this feature, but we are not gated on any of those and fully support App Javascript.
- **CSS:** available for `@import` by other CSS files (both in the same package and across packages) and by ECMA `import` directives in Javascript modules (both in the same package and across packages).
- **Assets**: any files that must be available in the final built application directory such that they have public URLs (typical examples are images and fonts).
- **Build Hooks**: code that runs within Node at application build time. The v1 equivalent is an addon's `index.js` file.

## Own Javascript

The public `main` (as defined in `package.json`) of a v2 package points to its **Own Javascript**. The code is formatted as ES modules using ES latest features. Templates are in place in hbs format, and any custom AST transforms have already been applied.

(Remember, we’re describing the _publication_ format, not the _authoring_ format. Authors can still do what they do today, using preprocessors provided by other addons. But that will all run before publishing.)

The benefit of this design is that it makes our packages understandable by a broader set of tooling. Editors and build tools can follow `import` statements across packages and end up in the right place.

In v1 packages, `main` usually points to a build-time configuration file. That file is moving and will be described in the **Addon Hooks** section below.

Modules in **Own Javascript** are allowed to use ECMA static `import` to resolve any **allowed dependency**, causing it to be included in the build whenever the importing module is included. This replaces `app.import`.

Notice that a package’s **allowed dependencies** do not include the package itself. This is consistent with how node module resolution works. This is different from how run-time AMD module resolution has historically worked in Ember Apps, so the build step that produces the v2 publication format will need to adjust import paths appropriately. For example, if `your-package/a.js` tries to import from `"your-package/b"`, that needs to get rewritten to “`./b`".

Modules in **Own Javascript** are also allowed to use the (currently stage 3) ECMA dynamic `import()`, and the specifiers have the same meanings as in static import. We impose one caveat: only string-literal specifiers are supported. So `import('./lang-en')` is OK but `import("./lang-"+language)` is not. We retain the option to relax this restriction in the future. The restriction allows us to do better analysis of possible inter-module dependencies (see **Build-time Conditionals** below for an example).

Modules in **Own Javascript** are allowed to import template files. This is common in today’s addons (they import their own layout to set it explicitly). But import specifiers of templates are required to include the `.hbs` extension.

Modules in **Own Javascript** are allowed to use `hbs` tagged template strings as provided by `ember-cli-htmlbars-inline-precompile`, and we promise to compile the templates at app build time.

You’re allowed to `import` from both other v2 Ember packages and non-Ember packages. The only difference is that v2 Ember packages necessarily agree to provide ES modules with ES latest features, and so we will always apply the application’s browser-specific Babel transpilation to them. Non-Ember packages can be authored in lots of ways, and we will use best-effort to consume them, including conversion of ESM or CJS to whatever format we’re using in the browser (currently AMD), but we won’t apply the app’s Babel transpilation to them, because it’s usually just unnecessary expense — the most common way to ship NPM packages outside of well-known build systems like ember-cli is to transpile before publication.

_A recent lesson from ember-auto-import is that we’re going to want to allow people to opt-in to babel transpilation of specific foreign packages, as the wider ecosystem’s norms evolve and more projects ship modern JS untranspiled. Unfortunately there is no simple correct universal answer here. Double transpilation is not safe in general, since choices get made about how to map between modules, AMD, UMD, etc._

## How we teach this

> What names and terminology work best for these concepts and why? How is this
> idea best presented? As a continuation of existing Ember patterns, or as a
> wholly new one?

> Would the acceptance of this proposal mean the Ember guides must be
> re-organized or altered? Does it change how Ember is taught to new users
> at any level?

> How should this feature be introduced and taught to existing Ember
> users?

## Drawbacks

> Why should we _not_ do this? Please consider the impact on teaching Ember,
> on the integration of this feature with other existing and planned features,
> on the impact of the API churn on existing apps, etc.

> There are tradeoffs to choosing any path, please attempt to identify them here.

## Alternatives

> What other designs have been considered? What is the impact of not doing this?

> This section could also include prior art, that is, how other frameworks in the same domain have solved this problem.

## Unresolved questions

> Optional, but suggested for first drafts. What parts of the design are still
> TBD?
