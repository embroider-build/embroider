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
- injecting content into index.html (contentFor)

It is understood that all of these are legitimate things for Ember addons to do. Defining these capabilities within v2 packages will be done in followup RFCs. It is simply too much scope to cover in one RFC.

Because we're hyper-focused on backward- and forward-compatibility, there is no harm in progressively converting some addons to v2 (which provides immediate benefits) while others need to stay as v1 until we offer the features they need.

Splitting up into multiple RFCs also increases the likelihood that we can parallelize some of the effort.

## Package Public API Overview

The structure we are about to describe _is a publication format_. Not necessarily an authoring format. By separating the two, we make it easier to evolve the authoring formats without breaking ecosystem-wide compatibility. The publication format is deliberately more explicit and less dynamic that what we may want for an authoring format.

First, here’s the list of things a v2 package can provide. More detail on each of these will follow:

- **Own Javascript**: javascript and templates under the package’s own namespace (the v1 equivalent is `/addon/**/*.{js,hbs}/`)
- **App Javascript**: javascript and templates that must be merged with the consuming app’s namespace (the v1 equivalent is `/app/**/*.{js,hbs}`). Other RFCs are working to move Ember away from needing this feature, but we are not gated on any of those and fully support App Javascript.
- **CSS**: available for `@import` by other CSS files (both in the same package and across packages) and by ECMA `import` directives in Javascript modules (both in the same package and across packages).
- **Implicit Dependencies**: scripts, modules, and stylesheets that should be implicitly included in the app or the app's tests whenever this addon is active. This is a compatibility feature.
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

## App Javascript

To provide **App Javascript**, a package includes the `app-js` key in **Ember package metadata**. For example, to duplicate the behavior of v1 packages, you could say:

    "ember-addon": {
      "version": 2,
      "app-js": "./app"
    }

Like the **Own Javascript**, templates are in place in hbs format with any AST transforms already applied. Javascript is in ES modules, using only ES latest features. ECMA static and dynamic imports from any **allowed dependency** are supported. (Even though the app javascript will be addressable within the _app's_ module namespace, your own imports still resolve relative to your addon.)

By making `app-js` an explicit key in **Ember package metadata**, our publication format is more durable (you can rearrange the conventional directory structure in the future without breaking the format) and more performant (less filesystem traversal is required to decide whether the package is using the **App Javascript** feature.

## CSS

To provide **CSS**, a package can include any number of CSS files. These files can `@import` each other via relative paths, which will result in build-time inclusion (as already works in v1 packages).

If any of the **Own Javascript** or **App Javascript** modules depend on the presence of a CSS file in the same package, it should say so explicitly via an ECMA relative import, like:

    import '../css/some-component.css';

This is interpreted as a build-time directive that ensures that before the Javascript module is evaluated, the CSS file's contents will be present in the DOM. ECMA import of CSS files must always include the explicit `.css` extension.

> Q: Does this interfere with the ability to do CSS-in-JS style for people who like that?

> A: No, because that would be a preprocessing step before publication. It’s a choice of authoring format, just like TypeScript or SCSS. CSS-in-JS people would compile all their things to ES modules before we deal with it.

It is also possible for other packages (including the consuming application) to depend on a CSS file in any of its **allowed dependencies**, from either Javascript or CSS. From Javascript it looks like:

    // This will resolve the `your-addon` package and find
    // './some-component.css' relative to the package root.
    // The .css file extension is mandatory
    import 'your-addon/some-component.css';

And from CSS it looks like:

    @import 'your-addon/some-component';

What about SCSS _et al_? You’re still free to use them as your authoring format, and they should be transpiled to CSS in your publication format. If you want to offer the original SCSS to consuming packages, you’re free to include it in the publication format too. Since we’re making all packages resolvable via normal node rules, it’s now dramatically easier to implement a preprocessor that supports inter-package dependencies. (The same logic applies to TypeScript.)

## Implicit Dependencies

FIXME: fill out this section

New addon's are encouraged to use direct ECMA `import` or CSS `@import` to express explicit, fine-grained dependencies in favor of these coarse, implicit dependencies.

## Assets

To provide **Assets**, a package includes the `public-assets` key in **Ember package metadata**. It's a mapping from local paths to app-relative URLs that should be available in the final app. For example:

    "name": "my-addon",
    "ember-addon": {
      "version": 2,
      "public-assets": {
        "./public/image.png": "/my-addon/image.png"
      }
    }

with:

    my-addon
    └── public
        └── image.png

will result in final build output:

    dist
    └── my-addon
        └── image.png

Notice that we’re _not_ choosing to include assets via explicit ECMA `import`. The reason is that fine-grained inclusion of asset files is not critical to runtime performance. Any assets that your app doesn’t actually need, it should never fetch. Assets are always things with their own URLs.

If two V2 packages try to emit assets with the same public URL, that's a build error.

> Q: Should we just automatically namespace them instead?
> A: That was considered, but it makes backward compatibility harder, and public URLs are not always free to choose/change.

## Build Hooks

In today’s v1 addon packages, the `index.js` file is the main entrypoint that allows an addon to integrate itself with the overall ember-cli build pipeline. The same idea carries forward to v2, with some changes.

It is no longer the `main` entrypoint of the package (see **Own Javascript**). Instead, it’s located via the `build` key in **Ember package metadata**, which should point at a Javascript file. `build` is optional — if you don’t have anything to say, you don’t need the file.

It is now an ECMA module, not a CJS file. The default export is a class that implements your build hooks (there is no required base class).

Here is a list of build hooks, each of which will have its own section below. They are listed in the order they will run:

- configure
- configureDependencies

I will describe the hooks using TypeScript signatures for precision. This does not imply anything about us actually using TypeScript to implement them. Each package has two type variables:

- `PackageOptions` is the interface for what options you accept from packages that depend on you. It's your package's build-time public API.
- `OwnConfig` is the interface for the configuration that you want to send to your own code, which your code can access via the `getOwnConfig` macro. This is how you influence your runtime code from the build hooks.

### Build Hook: configure

```ts
interface ConfigurationRequest<PackageOptions> = {
  options: PackageOptions,
  fromPackageName: string,
  fromPackageRoot: string,
};
configure<PackageOptions, OwnConfig>(
  requests: ConfigurationRequest<PackageOptions>[]
): OwnConfig
```

The configure hook receives an array of configuration requests. Each request contain the `PackageOptions` that a package that depends on this addon has sent to this addon. It also includes the `fromPackageName` and `fromPackageRoot` (the full path on disk to the requesting package) so that any configuration errors can blame the proper source.

`configure` deals with an array because multiple packages may depend on a single copy of our package. But our package can only be configured in one way (for example, we are either going to include some extra code or strip it out via the macro system, but we can't do both).

Addons are encouraged to merge configuration requests intelligently to try to satisfy all requesters. If it's impossible to do so, you can throw an error that explains the problem.

The `OwnConfig` return value must be JSON-serializable. It becomes available to your **Own Javascript** via the `getOwnConfig` macro, so that it can influence what code is conditionally compiled out of the build.

### Build Hook: configureDependencies

TODO: search for `disableDependencies`, it should all be factored out.
TODO: remember to include optional peer deps

```ts
configureDependencies(): { [dependencyName: string]:
```

`disableDependencies` returns a list of package names of Ember packages that you want to disable. If you don't implement `disableDependencies`, all your Ember package dependencies are active.

When and only when a package is active:

- all standard Ember module types (`your-package/components/*.js`, `your-package/services/*.js`, etc) from its **Own Javascript** _that cannot be statically ruled out as unnecessary_ are included in the build as if some application code has `import`ed them. (What counts as “cannot be statically ruled out” is free to change as apps adopt increasingly static practices. This doesn’t break any already published packages, it just makes builds that consume them more efficient.)
- all of the package's **Implicit Dependencies** are included in the build.
- all **App Javascript** is included in the build.
- all **Assets** are included in the build.
- the package's **Active Dependencies** become active recursively.
  ​​
  Whether or not a package is active:

- directly-imported **Own Javascript** and **CSS** are available to any other package as described in those sections. The rationale for allowing `import` of non-active packages is that (1) we follow node module resolution and node module resolution doesn’t care about our notion of “active”, and (2) `import` is an explicit request to use the module in question. It’s not surprising that it would work, it would be more surprising if it didn’t.

The `configureDependencies` hook is the _only_ way to disable child packages. The package hooks are implemented as a class with no base class. There is no `super` to manipulate to interfere with your children’s hooks.

## What about Test Support?

v1 packages can provide `treeForTestSupport`, `treeForAddonTestSupport`, and `app.import` with `type="test"`. All of these features are dropped.

To provide test-support code, make a separate module within your package and tell people to `import` it from their tests. As long as it is only imported from tests, it will not be present in non-test bundles. (Things get simpler when you respect the module dependency graph.)

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
