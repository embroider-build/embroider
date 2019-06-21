- Start Date: 2019-06-21
- Relevant Team(s): Ember CLI, Ember.js, Learning
- RFC PR:
- Tracking:

# v2 Package Format (Embroider Compatibility)

## Summary

This RFC defines a new package format that is designed to make all Ember packages (which includes both Addons and Apps) statically analyzable and more compatible with the rest of the NPM & Javascript ecosystem.

Most of this RFC is already implemented in [Embroider](https://github.com/embroider-build/embroider). Embroider can compile most existing packages to v2 packages. There is a [tracking issue](FIXME) for the remaining gaps between this RFC and the current implementation.

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

- **Own Javascript**: javascript and templates under the package’s own namespace (the v1 equivalent is `/addon/**/*.{js,hbs}/`)
- **App Javascript**: javascript and templates that must be merged with the consuming app’s namespace (the v1 equivalent is `/app/**/*.{js,hbs}`). Other RFCs are working to move Ember away from needing this feature, but we are not gated on any of those and fully support App Javascript.
- **CSS:** available for `@import` by other CSS files (both in the same package and across packages) and by ECMA `import` directives in Javascript modules (both in the same package and across packages).
- **Assets**: any files that must be available in the final built application directory such that they have public URLs (typical examples are images and fonts).
- **Build Hooks**: code that runs within Node at application build time. The v1 equivalent is an addon's `index.js` file.

## Own Javascript

The public `main` (as defined in `package.json`) of a v2 package points to its **Own Javascript**. The code is formatted as ES modules using ES latest features, meaning: stage 4 features only, unless otherwise explicitly mentioned elsewhere in this spec. (Addon authors can still use whatever custom syntax they want, but those babel plugins must run before publication to NPM.)

Templates are in hbs format. No custom AST transforms are supported. (Addon authors can still use whatever custom AST transforms they want, but those transforms must have already been applied before publication to NPM.)

Unlike v1 addons, there is no `/app` or `/addon` directory that is magically removed from the runtime paths to the modules. All resolution follows the prevailing Node rules.

The benefit of this design is that it makes our packages understandable by a broader set of tooling. Editors and build tools can follow `import` statements across packages and end up in the right place.

In v1 packages, `main` usually points to a build-time configuration file. That file is moving and will be described in the **Build Hooks** section below.

### Own Javascript: Imports

Modules in **Own Javascript** are allowed to use ECMA static `import` to resolve any **allowed dependency**, causing it to be included in the build whenever the importing module is included. This replaces `app.import`. Resolution follows prevailing Node rules. (This usually means the node_modules algorithm, but it could also mean Yarn PnP. The difference shouldn't matter if you are correctly declaring all your **allowed dependencies**.)

Notice that a package’s **allowed dependencies** do not include the package itself. This is consistent with how Node resolution works. To import files from within your own package you must use relative paths. This is different from how run-time AMD module resolution has historically worked in Ember Apps. (`@embroider/compat` implements automatic adjustment for this case when compiling from v1 to v2).

Modules in **Own Javascript** are allowed to use dynamic `import()`, and the specifiers have the same meanings as in static import. However, we impose a restriction on what syntax is supported inside `import()`. The only supported syntax inside `import()` is:

- a string-literal
- or a template string literal
  - that begins with a static part
  - where the static part is required to contain at least one `/`
  - or at least two `/` when the path starts with `@`.

This is designed to allow limited pattern matching of possible targets for your dynamic `import()`. The rules ensure that we can always tell which NPM package you are talking about (the `@` rule covers namespaced NPM packages, so you can't depend on `@ember/${whatever}` but you can depend on `@ember/translations/${lang}`). If your pattern matches zero files, we consider that a static build error.

Modules in **Own Javascript** are allowed to import template files. This is common in today’s addons (they import their own layout to set it on their Component class). But in v2 packages, import specifiers of templates are required to explicitly include the `.hbs` extension.

### Own Javascript: Transpilation of imported modules

Any module you import, whether from an Ember package or a non-Ember package, gets processed by the app's babel configuration by default. This ensures that the app's `config/targets.js` will always be respected and you won't accidentally break your older supported browsers by importing a dependency that uses newer ECMA features.

There is an explicit per-package opt-out for cases where you're _sure_ that transpilation is not needed and not desirable. (See **Build Hooks** for details on the `skipBabel` option.)

## Own Javascript: Supported module formats for non-Ember packages

As already stated, V2 Ember packages must contain only ES modules. However, non-Ember packages in your **allowed dependencies** are allowed to contain ES modules _or_ CommonJS modules. This provides the best compatibility with general-purpose NPM utilities.

### Own Javascript: Macros

The V2 format deliberately eliminates many sources of app-build-time dynamism from addons. Instead, we provide an equivalently-powerful macro system and consider it an always-supported language extension (the macros are always available to every V2 package, ambiently, and we promise to give them their faithful build-time semantics).

See **Macro System** for the full details.

## Macro System

- remember to include `hbs` here

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
