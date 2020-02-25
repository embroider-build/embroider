# V2 Package Spec

# Motivation

One of the good things about Ember is that apps and addons have a powerful set of build-time capabilities that allow lots of shared code with zero-to-no manual integration steps for the typical user. We have been doing “zero config” since before it was a cool buzzword (it was just called “convention over configuration”). And we’ve been broadly successful at maintaining very wide backward- and forward-compatibility for a large body of highly-rated community-maintained addons.

But one of the challenging things about Ember is that our ecosystem’s build-time capabilities are more implementation-defined than spec-defined, and the implementation has accumulated capabilities organically while only rarely phasing out older patterns. I believe the lack of a clear, foundational, build-time public API specification is the fundamental underlying issue that efforts like the various packaging / packager RFCs have tried to work around.

The benefits to users for this RFC are:

- faster builds and faster NPM installs
- “zero-config import from NPM — both static and dynamic” as a first-class feature all apps and addons can rely on.
- immediate tree-shaking of app- and addon-provided modules that are consumed directly via ECMA imports (for example, any ember-animated transition you don’t use in your app won’t get included in the build), with a smooth improvement path for steadily increasing the level of static analysis as other efforts like templates imports land.
- a more approachable build system that enables more people to contribute and better integration with other JS toolchains.

# Key Ideas

## Fully Embrace ES Modules

Ember was one of the earliest adopters of ECMAScript modules, and Ember core team members were directly involved in helping move that features through TC39. Ember’s early experiences with modules influenced the spec itself. _Yet we have lagged in truly embracing modules._

For example, how do Ember apps express that they depend on a third-party library? The [app.import](https://ember-cli.com/user-guide/#javascript-assets) API. This should be ECMA standard `import`.

Another way to state the problem is that apps and addons all _push_ whatever code they want into the final built app. Whereas ES modules can _pull_ each other into the build as needed.

## Play nice with NPM Conventions

The ECMA module spec by itself doesn’t try to define a module resolution algorithm. But the overwhelmingly most popular convention is the [node_modules resolution algorithm](https://nodejs.org/api/all.html#modules_all_together).

Ember addons do respect node_module resolution for build-time code, but they do not respect it for runtime code. There’s no reason not to.

## Verbose, Static Javascript as a Compiler Target

Ember’s strong conventions mean that many kinds of dependencies can be inferred (including _statically_ inferred) without requiring the developer to laboriously manage them. This is a good thing and I believe the current fad in the wider Javascript ecosystem for making developers hand-write verbose static imports for everything confuses the benefits of having static analysis (which is good) with the benefits of hand-managing those static imports (which is unnecessary cognitive load when you have clear conventions and a compiler).

This design is about compiling today’s idiomatic Ember code into more “vanilla” patterns that leverage ES modules, node_modules resolution, and spec-compliant static and dynamic `import` to express the structure of an Ember application in a much more “vanilla Javascript” way.

This compile step lets us separate the authoring format (which isn’t changing in any significant way in this RFC) from the packaging format (which can be more verbose and static than we would want in an authoring format).

# Detailed Design

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

## Package Public API Overview

The structure we are about to describe _is a publication format_. Not necessarily an authoring format. By separating the two, we make it easier to evolve the authoring formats without breaking ecosystem-wide compatibility. The publication format is deliberately more explicit and less dynamic that what we would want for an authoring format.

First, here’s the list of things a v2 package can provide. More detail on each of these will follow:

- **Own Javascript**: javascript and templates under the package’s own namespace (the v1 equivalent is `/addon/**/*.js/`)
- **App Javascript**: javascript and templates that must be merged with the consuming app’s namespace (the v1 equivalent is `/app/**/*.js`). This likely stops being needed when use with a template imports feature, but v2 package format is not dependent on that.
- **CSS:** available for `@import` by other CSS files (both in the same package and across packages) and by ECMA `import` directives in Javascript modules (both in the same package and across packages).
- **Assets**: any files that should be available in the final built application directory (typical examples are images and fonts).
- **Middleware**: express middleware that will mount automatically during development, unchanged from v1.
- **Preprocessors**: for producing JS, CSS, or HBS.
- **Commands**: commands that can be invoked from the command line. Unchanged from v1.
- **Blueprints**: blueprints for generating new files from the command line. Unchanged from v1.
- **ContentFor**: the ability to insert snippets into key places, like the document header.
- **Active Dependencies**: the subset of a given package’s **allowed dependencies** that are Ember packages and that the given package considers active.

## Own Javascript

The public `main` (as defined in `package.json`) of a v2 package points to its **Own Javascript**. The code is formatted as ES modules using ES latest features. Templates are in place in hbs format, and any custom AST transforms have already been applied.

(Remember, we’re describing the _publication_ format, not the _authoring_ format. Authors can still do what they do today, using preprocessors provided by other addons. But that will all run before publishing.)

The benefit of this design is that it makes our packages understandable by a broader set of tooling. Editors and build tools can follow `import` statements across packages and end up in the right place.

In v1 packages, `main` usually points to a build-time configuration file. That file is moving and will be described in the **Addon Hooks** section below.

Modules in **Own Javascript** are allowed to use ECMA static `import` to resolve any **allowed dependency**, causing it to be included in the build whenever the importing module is included. This replaces `app.import`.

Notice that a package’s **allowed dependencies** do not include the package itself. This is consistent with how node module resolution works. This is different from how run-time AMD module resolution has historically worked in Ember Apps, so the build step that produces the v2 publication format will need to adjust import paths appropriately. For example, if `your-package/a.js` tries to import from `"your-package/b"`, that needs to get rewritten to “`./b`".

Modules in **Own Javascript** are also allowed to use the (currently stage 3) ECMA dynamic `import()`, and the specifiers have the same meanings as in static import. We impose one caveat: only string-literal specifiers are supported. So `import('./lang-en')` is OK but `import("./lang-"+language)` is not. We retain the option to relax this restriction in the future. The restriction allows us to do better analysis of possible inter-module dependencies (see **Build-time Conditionals** below for an example).

Modules in **Own Javascript** are allowed to import template files. This is common in today’s addons (they import their own layout to set it explicitly).

Modules in **Own Javascript** are allowed to use `hbs` tagged template strings as provided by `ember-cli-htmlbars-inline-precompile`, and we promise to compile the templates at app build time.

You’re allowed to `import` from both other v2 Ember packages and non-Ember packages. The only difference is that v2 Ember packages necessarily agree to provide ES modules with ES latest features, and so we will always apply the application’s browser-specific Babel transpilation to them. Non-Ember packages can be authored in lots of ways, and we will use best-effort to consume them, including conversion of ESM or CJS to whatever format we’re using in the browser (currently AMD), but we won’t apply the app’s Babel transpilation to them, because it’s usually just unnecessary expense — the most common way to ship NPM packages outside of well-known build systems like ember-cli is to transpile before publication.

_A recent lesson from ember-auto-import is that we’re going to want to allow people to opt-in to babel transpilation of specific foreign packages, as the wider ecosystem’s norms evolve and more projects ship modern JS untranspiled. Unfortunately there is no simple correct universal answer here. Double transpilation is not safe in general, since choices get made about how to map between modules, AMD, UMD, etc._

## App Javascript

To provide **App Javascript**, a package includes the `app-js` key in **Ember package metadata**. For example, to duplicate the behavior of v1 packages, you could say:

    "ember-addon": {
      "version": 2,
      "app-js": "./app"
    }

Like the **Own Javascript**, templates are in place in hbs format with any AST transforms already applied. Javascript is in ES modules, using only ES latest features. ECMA static and dynamic imports from any **allowed dependency** are supported.

By making this an explicit key in **Ember package metadata**, our publication format is more durable (you can rearrange the conventional directory structure in the future without breaking the format) and more performant (less filesystem traversal is required to decide which features the package is using).

## CSS

To provide **CSS**, a package can include any number of CSS files. These files can `@import` each other via relative paths, which will result in build-time inclusion (as already works in v1 packages).

If any of the **Own Javascript** or **App Javascript** modules depend on the presence of a CSS file in the same package, it should say so explicitly via an ECMA relative import, like:

    import '../css/some-component.css';

This is interpreted as a build-time directive that ensures that before the Javascript module is evaluated, the CSS file's contents will be present in the DOM.

> Q: Does this interfere with the ability to do CSS-in-JS style for people who like that?

> A: No, because that would be a preprocessing step before publication. It’s a choice of authoring format, just like TypeScript or SCSS.

It is also possible for other packages (including the consuming application) to depend on a CSS file in any of its **allowed dependencies**, from either Javascript or CSS. From Javascript it looks like:

    // This will resolve the `your-addon` package and find
    // './some-component.css' relative to the package root.
    // The .css file extension is mandatory
    import 'your-addon/some-component.css';

And from CSS it looks like:

    @import 'your-addon/some-component';

What about SCSS _et al_? You’re still free to use them as your authoring format, and they should be transpiled to CSS in your publication format. If you want to offer the original SCSS to consuming packages, you’re free to include it in the publication format too. Since we’re making all packages resolvable via normal node rules, it’s now dramatically easier to implement a preprocessor that supports inter-package dependencies. (The same logic applies to TypeScript.)

## Assets

To provide **Assets**, a package includes the `public-assets` key in **Ember package metadata**. It's a mapping from local paths to app-relative URLs that should be available in the final app.

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

Notice that we’re _not_ choosing to include assets via explicit ECMA `import`. The reason is that fine-grained inclusion of asset files is not critical to runtime performance. Any assets that your app doesn’t actually need, it should never fetch.

## ContentFor

The following targets are supported the same as in v1 packages:

- head
- head-footer
- body
- body-footer
- test-head
- test-head-footer
- test-body
- test-body-footer
- config-module

The following targets are deprecated because they tie us permanently to the idea of fixed app/test/vendor Javascript bundles, and because they are not widely used according to the EmberObserver code search:

- app-boot
- app-prefix
- app-suffix
- test-support-prefix
- test-support-suffix
- vendor-prefix
- vendor-suffix

## What about Tests?

v1 packages can provide `treeForTestSupport`, `treeForAddonTestSupport`, and `app.import` with `type="test"`. All of these features are dropped.

To provide test-support code, make a separate module within your package and tell people to `import` it from their tests. As long as it is only imported from tests, it will not be present in non-test bundles.
​​

## Package Hooks

In today’s v1 addon packages, the `index.js` file is the main entrypoint that allows an addon to integrate itself with the overall ember-cli build pipeline. The same idea carries forward to v2, with some changes.

It is no longer the `main` entrypoint of the package (see **Own Javascript**). Instead, it’s located via the `build` key in **Ember package metadata**, which should point at a Javascript file. `build` is optional — if you don’t have anything to say, you don’t need the file.

It is now an ECMA module, not a CJS file. The default export is a class that implements your addon hooks (no base class is required).

One area that is under-documented and under-designed in the existing hooks is: which ones cascade into active grandchild addons? Do they cascade via `super` so you can (accidentally or on purpose) block the cascade? Section **Active Dependencies** makes these rules consistent and clear.

List of existing v1 public methods and properties on addons, and their disposition in v2:

- blueprintsPath: unchanged in v2
- buildError: Kept. This is an event hook that makes it possible to implement things like ember-cli-build-notifications.
- cacheKeyForTree: Dropped. This is a build-time feature, it doesn’t belong in the publication format.
- config: TODO.
- contentFor: Some of the possible destinations for content are removed. See **ContentFor** section.
- dependencies: Dropped. Can’t find any usages in the wild.
- description: Dropped. This is redundant with the description in package.json.
- import: Dropped. This is replaced with actual ECMA `import` for both Javascript and CSS.
- importTransforms: Dropped, because this goes with `this.import()` above. All examples in the wild that I could find are handled better by other alternatives.
  - the CJS and AMD transforms aren’t needed because better packagers can automate the transformation of both, as demonstrated by ember-auto-import
  - the fastboot transform is used to neuter whole dependencies in fastboot. This can be handled by ECMA dynamic `import()` instead.
  - most other occurrences in the EmberObserver code search are actually addons re-exporting the fastboot transform (because apparently `importTransforms` doesn’t cascade properly).
- included: Unchanged, but it should be needed much more rarely. Today it is mostly used to `this.import()` things, which is not a thing anymore.
- includedCommands: Unchanged.
- init: Dropped in favor of `constructor`, since we’re now talking about a native class.
- isDevelopingAddon: Dropped. This doesn’t belong in each addon’s code, it’s a runtime decision and control over it belongs in ember-cli proper.
- isEnabled: Dropped. Rarely used. This decision doesn’t belong inside an addon, it belongs in the addon’s parent which will decide to activate it or not. Putting it here means every addon needs to invent its own API for how to tell it to activate or not.
- lintTree: Kept. This is a legit runtime thing to do.
- moduleName: Dropped. Using a moduleName that doesn’t match your NPM package name is a megatroll, and it won’t work with build tools that know how to follow the Node package resolution algorithm.
- name: Dropped. Setting a name that doesn’t match your NPM package name is a megatroll.
- outputReady: Kept.
- postBuild: Kept.
- postprocessTree: TODO. need to confirm existing pre/postprocessTree behaviors. I think most of the trees (js, styles, templates, all) only apply to your immediate parent, meaning they can run at publication time when they’re being applied to an addon.
- preBuild: Kept
- preprocessTree: TODO. Same boat as postprocessTree.
- serverMiddleware: Kept.
- setupPreprocessorRegistry: Kept. But remember, it will have an effect whenever the consuming package is built, which for apps will be the same as today, but for addons will be publication time.
- shouldIncludeChildAddon: Dropped in favor of `activeDependencies` because we’re changing the semantics. This method receives a complete instance representing each child addon, which unintentionally exposes way too much API. And the meaning of being an active dependency has been rationalized. See section **Active Dependencies**.
- testemMiddleware: Kept.
- treeFor, treeForAddon, treeForAddonTemplates, treeForAddonTestSupport, treeForApp, treeForPublic, treeForStyles, treeForTemplates, treeForTestSupport, treeForVendor: Dropped. Dynamically generating broccoli trees at app build time is no longer supported. Your trees are built at publication time. If you need to produce different output at build time based on dynamic configuration, see **Build-time Conditionals**.

New addon hooks:

- `activeDependencies`: defined in its own section below

Finally, your `build` module may export named constants that will be made available to your runtime Javascript. See **Build-time Conditionals** for details.

## Build-time Conditionals

The v2 format deliberately moves a lot of dynamic behavior to publication time. So how do we deal with remaining cases where different code needs to be included based on dynamic information?

You may export named `const` values from your `build` module (as defined in the **Addon Hooks** section). These constants will be available to your Javascript via `import { someConstant } from` `'@ember/build-time-config/your-package-name'`, and we guarantee that a dead-code elimination step can see any boolean constant branch predicates (this is how feature flags already work inside Ember itself). For example:

    import { needsLegacySupport } from '@ember/build-time-config/my-package';
    let MyComponent = Component.extend({
      //....
    });
    if (needsLegacySupport) {
      MyComponent.reopen({
        // add some extra code here. It will be stripped from builds that don't need it.
      });
    }
    export default MyComponent;

This is also a motivating example for our support of dynamic `imports()`: it allows you to conditionally depend on other JS modules or CSS:

    import { provideDefaultStyles } from '@ember/build-time-config/my-package';
    if (provideDefaultStyles) {
      import("../css/default-styles.css");
    }

Your `build` module is evaluated in Node, not the browser. We just promise that any JSON-serializable constants it exports will get packaged up into the special Ember-provided `@ember/build-time-config` package.

**Template Build-time conditionals**

TODO: this section is a rough first pass. Once clarified, it should also get reflected in the other places where we talk about the template publication format.

We also need build-time conditional capability in templates, because (for example) many of the AST transforms we will be asking addons to pre-apply are supposed to behave differently depending on the Ember version.

The input data is exactly the same as used for Javascript build-time conditionals (any JSON-serializable constants exported from your build module are available via the `@ember/build-config-config` package). We add a helper for accessing those values:

    {{#if (ember-build-time-config "my-package" "needsOldFeature")}}
       ...
    {{else}}
       ...
    {{/if}}

And we implement a transform in the template compiler that does branch elimination based off the values.

Note that only Boolean predicates are handled by the dead-code elimination. You can produce Booleans from arbitrary logic in your `build` module (including things like semver tests or feature probing).

## Active Dependencies

The `activeDependencies` hook receives the list of names of your **allowed dependencies** that are Ember packages as input and returns either the same list or a subset of the list:

    activeDependencies(childPackageNames) {
      if (someThingIsDisabled) {
        return childPackageNames.filter(name => name !== 'the-one-we-dont-need');
      } else {
        return childPackageNames;
      }
    }

If you don’t implement the `activeDependencies` hook, all your `dependencies` are considered active.

When and only when a package is active:

- all standard Ember module types (`your-package/components/*.js`, `your-package/services/*.js`, etc) from its **Own Javascript** _that cannot be statically ruled out as unnecessary_ are included in the build as if some application code has `import`ed them. (What counts as “cannot be statically ruled out” is free to change as apps adopt increasingly static practices. This doesn’t break any already published packages, it just makes builds that consume them more efficient.)
- if your **Ember package metadata** contains `"implicit-scripts"` or `"implicit-test-scripts"`, the listed scripts will be included in the consuming app or its tests, respectively. Each of these keys can contain a list of specifier strings that will be resolved relative to the package. This is a backward-compatibility feature for capturing the behavior of v1 packages. New features are encouraged to use direct `import` where possible.

Example:
"ember-addon": {
"version": 2,
"implicit-scripts": ["./vendor/my-package/some-shim", "lodash/sortBy"]
}
Scripts included this way are _not_ interpreted as ES modules. They are evaluated in script context (think `<script src="./vendor/my-package/some-shim.js">` not `<script type="module"` `src="./vendor-my-package/some-shim.js">`.

- all **App Javascript** is included in the build.
- **Preprocessors** apply to the consuming package. In the case of an addon with an active child addon that provides a preprocessor, this is only interesting at publication time, not built time, because that is when preprocessors run for addon code.
- **Middleware**, **Commands**, and **Blueprints** are available.
- **ContentFor** is injected.
- **Assets** are included in the build.
- its **Active Dependencies** become active recursively.

Whether or not a package is active:

- directly-imported **Own Javascript** and **CSS** are available to any other package as described in those sections. The rationale for allowing `import` of non-active packages is that (1) we follow node module resolution and node module resolution doesn’t care about our notion of “active”, and (2) `import` is an explicit request to use the module in question. It’s not surprising that it would work, it would be more surprising if it didn’t.

The `activeDependencies` hook is the _only_ way to disable child packages. Notice that the package hooks are now implemented as a class with no base class. There is no `super` to manipulate to interfere with your children’s hooks.

## Package Configurations and Multiple Instances

TODO: this section is a rough draft. It’s ideas need to get incorporated better into the rest of the doc, too.

v1 Addon packages make up their own conventions for how to receive configuration from their parent package(s). It’s messy. Many packages expect their config under a key that doesn’t actually match their own name (like `fingerprint` for `broccoli-asset-rev`), which makes things unnecessarily mysterious.

Furthermore, a package can be used by multiple other packages simultaneously. For some features (like preprocessors) this is fine, because multiple instances of a given package with distinct configurations can each operate independently. But for features like **Own Javascript**, there’s no desirable way for each instance to operate independently. A consensus must be reached. v1 packages just smoosh together the output from all instances, with a precedence that depends on ember-cli traversal order. This often wastes work, since multiple instances are doing the same thing.

In contrast, a v2 package that is consumed by multiple other packages is only instantiated once, and it can see all the configurations simultaneously. It’s required to come up with a single answer for (for example) any build-time configuration it wants to use to manipulate its own build via **Build-Time Conditionals**. The hooks that _do_ work fine independently such as preprocessor registration are called multiple times and receive each configuration as an argument. TODO: clarify each of the hooks in more detail.

## Addon build-time dependencies can become devDependencies

An addon that is published in v2 format has already applied all of the preprocessors and AST transforms that is needs to its own code. This means that many things that are today `dependencies` of addons can become `devDependencies` of addons. This results in a smaller overall `node_modules` tree for consuming apps, and faster NPM installs.

Examples of packages that are very frequently used as `dependencies` of addons that could stop being so include `ember-cli-htmlbars`, `ember-cli-babel`, and `ember-cli-sass`. Readers are invited to count how many copies of each of these appear in their apps today, and think about how nice it will be not to install all of those every time.

This is an example of embracing NPM conventions: best practice is to preprocess the unusual features out of your code before publishing.

## In-Repo Addons

In-repo addons are **addons**, so they have all the same semantics. The only gotcha is that we need them to be resolvable by the node modules resolution algorithm, such that their containing package can import directly from them.

Therefore, a v2 package that contains in-repo addons is responsible for linking or copying them into its own node_modules directory.

## Engines

Engines don’t require any special features in the v2 format.

Non-lazy engines are just addons that have more restrictive resolvers. This makes them already closer to how v2 formatted packages should behave (only accessing things that are in their own **allowed dependencies**).

Lazy engines require special build code today, but all of that is expressible as dynamic `import()`, so we can represent lazy engines in v2 format without introducing the “engine” concept to the v2 format itself. _Remember: the point of the v2 format is that most of the ember-specific knowledge — include what an “engine” is — has already been compiled out into more verbose, spec-defined features._

## Fastboot

Fastboot doesn’t require any special features in the v2 format.

Builds can do different things in fastboot vs browser by using **Build-Time Conditionals**.

Final-stage packagers already tend to have target support that allows them to optimize for browser vs node builds. In both cases they could consume the same v2-formatted packages as input.

All the work that goes into producing the full set of v2 packages is shared between browser and fastboot builds. The only differences are that we would change the build-time config for the ember-cli-fastboot package, and rerun the final stage packager with Node as the target.

## Apps as Packages

Apps are packages. For an app, the v2 publication format is not something you would probably ever publish to NPM. But it’s still important that it exists!

During the build process for an app, it will first build from its authoring format _to the standard v2 package format_. At that point, the whole project is just a collection of standard v2 packages with well-defined semantics, and we can confidently treat that stage in the build pipeline as supported public API.

The benefit of this approach is that we can separately evolve authoring formats and last-stage packaging tools, while keeping a stable interface between them. The stable interface is designed to leverage general-purpose ECMA-spec-compliant features wherever practical, which makes it a rich target.

v2-formatted apps do differ in a few ways from v2-formatted addon, as described in the following sections.

## Features That Apps May Not Use

Several features in the v2 addon format are designed to be consumed _by the app_. These features aren’t appropriate in an app, because that is the end of the line — a v2-formatted app should have no more Ember-specific build semantics.

These features include:

- the `implicit-*` keys in Ember package metadata.
- the `app-js` key in **Ember package metadata**
- the `build` key in **Ember package metadata**. (We should consider updating the _authoring_ format so that apps can use a build file with the standard package hooks, because that makes a lot of sense. But it’s not appropriate in the v2 build output, and this change can be a separate RFC, and it will be an easier RFC after landing this one.)
- automatic inclusion of resolvable types (components, services, etc) from the **Own Javascript** of all **Active Dependencies.**

All these features can appear in v2 _addons_, and the _app_ ensures each one is represented by standards-compliant Javascript within the app’s own code.

One feature that _is_ allowed in a v2 app is the `externals` key in **Ember package metadata**. This is designed to match up with a common feature on existing Javascript packagers that allows them to leave some module references unresolved until runtime.
​​

## App Package Additional Public API

These are features that are only supported in apps, not addons:

- `"assets"`: in **Ember package metadata**, a list of relative paths to files. The intent of `"assets"` is that it declares that each file in the list must result in a valid URL in the final app.

  The most important assets are HTML files. All `contentFor` has already been applied to them. (Remember, we’re talking about the publication format that can be handed to the final stage packager, not necessarily the authoring format.) It is the job of the final stage packager to examine each asset HTML file and decide how to package up all its included assets in a correct and optimal way, emitting a final result HTML file that is rewritten to include the packaged assets.

  Note that packagers must respect the HTML semantics of `<script type="module">` vs `<script>` vs `<script async>`. For example:

  - don’t go looking for `import` in `<script>`, it’s only correct in `<script type="module">`

  File types other than HTML are allowed to appear in `"assets"`. The intent is the same (it means these files must end up in the final build such that they’re addressable by HTTP). For example, a Javascript file in `"assets"` implies that you want that JS file to be addressable in the final app (and we will treat it as a script, not a module, because this is for foreign JS that isn’t going through the typical build system. If you actually want a separate JS file as output of your build, use `import()` instead). This is a catch-all that allows things like your `/public` folder full of arbitrary files to pass through the final stage packager.

  A conventional app will have an `"assets"` list that include `index.html`, `tests/index.html`, and all the files that were copied from `/public`.

- synchronous dynamic imports are allowed in the app’s Javascript. See next subsection.
- `"template-compiler"`: in **Ember package metadata**, the relative path to a module that is capable of compiling all the templates. The module’s exports :
  - `compile: (moduleName: string, templateContents: string) => string` that converts templates into JS modules.
  - `isParallelSafe: boolean`: true if this compiler can be used in other node processes
- `"babel-config"`: in Ember package metadata, the relative path to a module that exports a value with three properties:
  - `config`: the app’s preferred babel settings
  - `isParallelSafe: boolean`: true if the `babel` settings can be used in a new node process.
  - `version`: the version of babel the app's settings were written for.
- Unlike addons, an app’s **Own Javascript** is not limited to only ES latest features. It’s allowed to use any features that work with its exposed `"babel-config"`. This is an optimization — we _could_ logically require apps to follow the same rule as addons and compile down to ES latest before handing off to a final packager. But the final packager is going to run babel anyway, so we allow apps to do all their transpilation in that final single pass.

**Apps can use synchronous dynamic “imports”**

We need to make two small extensions beyond the ECMA spec, because Ember’s resolver is synchronous and dynamic. ECMA import gives us either asynchronous dynamic or synchronous static, but not synchronous dynamic (for a pretty good reason — browsers can’t really load a new dynamic asset synchronously).

Our extensions are:

- `importSync(specifier: string) => Module` a special form with the same syntax and semantics as `import()` except instead of returning a Promise it returns the module object synchronously or throws if it is not available.
- `mayImportSync StringLiteral` a special form that exists to inform a static analyzer that a given specifier might be accessed via `importSync`. Only valid at module scope. Any module that says `mayImportSync "something"` and every module that statically depends on it may safely assume that either `importSync("something")` will succeed or it will fail _at build time._ `mayImportSync` has no runtime semantics (it can compile to nothing by the time we are running in the browser).

In practice, final stage packagers already tend to offer `importSync` semantics (because they compile `import` to a synchronous function). `mayImportSync` is less supported, but given that we are keeping runtime AMD compatibility (see **Named AMD Interop** below), we can express it as `window.define("your-module", [], function(){ return importSync("your-module"); })`.

Q. What is the difference between `mayImportSync "thing"` and `import "thing"`, since both just cause `"thing"` to be statically added to our build?

A. `mayImportSync "thing"` doesn’t _execute_ the dependency. `import "thing"` guarantees that the dependency will be executed before any of the code in your module.

Only app packages can use this capability, not addons. It’s mostly of interest to people who want to integrate new final-stage packagers. Addons don’t need this capability because they delegate the responsibility to the consuming application.

You should think of `mayImportSync` and `importSync` as spec concepts, not literally code that will appear anywhere. In practice, someone integrating a packager can provide us hooks for how to express both of these concepts in terms that their packager understands.

In the future it is worth aligning Ember’s resolver with ECMA by eliminating the need for these extensions. It will require deprecating synchronous container `lookup`, etc, in favor of asynchronous resolution, so we can model is as `import()`.

## Complete input to final stage packagers

A final stage packager receives a directory containing a v2 app package. The app package’s dependencies are resolvable (via normal node rules) to v2 addon packages and non-Ember packages. All the Ember packages have a resolvable dependency on the special `@ember/build-time-config` package, which is built and ready to consume as normal ECMA modules.

## Package Flattening and Linking

One benefit of our current system _not_ respecting node_modules resolution everywhere is that it avoids the worst thing about node_modules: widespread module duplication. Browser applications very rarely want to ship multiple copies of the same dependency simultaneously. It adds bloat, and it can lead to very confusing bugs if duplicated modules have state.

This problem can be compounded when you use `npm link` to develop multiple packages simultaneously, since even if you were careful to flatten down your dependencies, you will suddenly have multiple distinct copies again.

This problem is general to NPM, and I think the solution should be equally general. So in one sense, it’s beyond the scope of this document and the v2 package spec doesn’t need to directly address it. But we should consider the usability impact. Some recommendations to assuage the impact:

- add a linting tool to the default app blueprint that will warn whenever a duplicated package would end up in the browser build. Many final-stage packagers already offer analysis features like this. For example, a webpack-based packager could integrate [duplicate-package-checker-webpack-plugin](https://github.com/darrenscerri/duplicate-package-checker-webpack-plugin) with the Ember build output or test suite.
- consider whether we can use Node’s [preserve symlink](https://nodejs.org/api/cli.html#cli_preserve_symlinks)s option to prevent `npm link` from introducing duplication.
- find or write a utility that does a more sophisticated `npm link` that also back-links all shared dependencies.

One hopeful NPM-ecosystem proposal is [Yarn Plugn’n’Play](https://github.com/yarnpkg/rfcs/pull/101). If that proposal or a similar one moves forward, everything in this spec still works, and only localized changes to our build code would be needed (no ecosystem-wide changes to all addons / packages would be needed).

## Compatibility / How we Ship This

My goal is to make it so we can automatically compile all v1 packages to v2 on demand. This allows us to immediately refactor the ember-cli build pipeline into a clean main path that only handles v2 packages, plus a nicely-encapsulated wrapper around v1 packages that does their precompilation.

We can also make v2 packages work with older ember-cli by taking advantage of the existing `main` key support in **Ember package metadata**. v2 packages will have their true `main` pointing at their **Own Javascript** as described so far, while pointing their `ember-addon.main` at a v2-to-v1 shim. This allows addon authors to begin to update immediately without dropping support for older ember-cli versions.

Addons can immediately begin relying on direct import from NPM by using ember-auto-import as a polyfill. In old ember-cli versions, the ember-auto-import will run. In new ember-cli versions, ember-auto-import can become a no-op. To make this fully align with the v2 build spec, ember-auto-import should gain CSS support to match.

**Named AMD Interop**

Our runtime AMD-based loader does not mesh well with ES module and node_modules resolution semantics. One big difference is that Named AMD `define` is allowed to create a module with whatever name you want, completely disconnected from which NPM package is actually doing the defining. Examples:

- `@ember/component` really gets transpiled into usage of the `Ember` global, which comes from `ember-source`.
- `moment` typically comes from `ember-cli-moment-shim`, which has its own `dependency` on `moment` and dynamically incorporates the right files into the build.
- `qunit` typically comes from `ember-qunit`.

This makes it basically impossible to statically discover all the modules at build time. It would be nice to completely jettison the whole named AMD loader, but in practice it is public API that is widely used. This design _does not_ propose any breaking changes to it.

To describe our interoperability strategy, we must first distinguish “run-time specifiers” and “build-time specifiers”. A run-time specifier (like `@ember/component`) is a name that is able to be `require`'d at runtime. A build-time specifier (like `ember-cli-shims/vendor/ember-cli-shims/app-shims`) is something you can actually `require.resolve` using Node resolution rules.

For many modules, the run-time and build-time specifiers happily coincide (or at least they do once we have run the v1 to v2 compiler step, which (for example) moves `ember-percy/addon/index.js` to `ember-percy/index.js` so that `import { percySnapshot } from` `"ember-percy"` follows normal node_modules resolution. This is the case for all `/app` and `/addon` Javascript that is authored in ES modules. It’s also already true for packages that adopt Module Unification (good job MU authors).

But for many other cases (including the examples like `@ember/component`), the build- and run-time specifiers are different.

The good news is, even though the `define` side is generally too dynamic to analyze, in practice Ember apps overwhelmingly use `import` on the consuming side, which we _can_ analyze. Any `import` specifier that appears in a v1 package can safely be assumed to already be available at runtime (or if it isn’t, the package was already broken and we aren’t making it any worse).

So our solution works like this:

1. Analyze the imports that appear in our package, partitioning them into ones that can be build-time resolved and ones that cannot. This is what ember-auto-import already does.
2. For imports that resolve to files within the same package, rewrite them as relative imports if they aren’t already (node_modules resolution does not allow packages to resolve themselves).
3. For imports that cannot be resolved, list them in the **Ember package metadata** as `externals`.
4. Our final-stage packager (like Webpack or Parcel) should be configured to find externals via our runtime AMD loader.
5. Our final-stage packager integration shall hook itself in as a fallback to `require` (for example, `require('foo')` would first find something that came from a runtime `define('foo', …)`, but then would also try `__webpack_require__('foo')`.

This allows statically-defined modules to depend on dynamically-defined modules (using externals), and it allows dynamically-defined modules to depend on statically-defined modules (because of the fallback hook).

The only failure mode for this design happens if a v1 package was doing a run-time resolution of a specifier that _happens to also be statically resolvable_. For example, if you’re using `ember-cli-moment-shim` to `import` `"moment"`, but you _also_ list `moment` in your package.json dependencies, when you switch to a v2 build you will start getting the direct `moment` and not the shim. In that case, you could get an unexpected version of moment. In practice, I think this is rare, and even when you get the surprising behavior you often wouldn’t get breaking behavior (because people generally don’t stomp on existing module names to provide something entirely different). Keep in mind it’s not sufficient that `moment` happens to be resolvable — we strictly check that you’ve actually listed it as a dependency. So even if `moment` gets hoisted out of `ember-cli-moment-shim`, you’re still safe. It’s only if you actually depend _directly_ on `moment` and `ember-cli-moment-shim` that you would get new behavior.

# How we Teach This

The impact on application authors is very small. As far as I can tell, there is almost nothing new to learn. The only visible API change should be that is becomes possible to `import` directly from any NPM package (as already demonstrated by ember-auto-import), and this is arguably one _less_ thing to learn about for new people, since they may very well already expect that to work.

We could consider deprecating `app.import`, but it can be compiled directly into a script tag that the final stage packagers understand, so it’s not worth deprecating immediately.

The impact on addon authors is more significant. This design is fully backward compatible, and the intention is that all existing addons continue to work (some with worse compatibility hacks than others in the v1-to-v2 compiler). But there will be a demand for addons published in v2 format, since it is expected to result in faster build times. My prediction is that people who are motivated to get their own app build times down will send a lot of PRs to the addons they’re using.

In many cases, converting addons to v2 makes them simpler. For example, today many addons use custom broccoli code to wrap third-party libraries in a fastboot guard that prevents the libraries from trying to load in Node (where they presumably don’t work). In v2, they can drop all that custom build-time code in favor of:

    if (!Fastboot) {
      await import('third-party-library');
    }

This design does _not_ advocate loudly deprecating any v1 addon features. Doing that all at once would be unnecessarily disruptive. I would rather rely on the carrot of faster builds than the stick of deprecation warnings. We can choose to deprecate v1 features in stages at a later time.

# Alternative Designs

This design effectively supersedes both the [Packager RFC](https://github.com/ember-cli/rfcs/blob/master/active/0051-packaging.md) and the [Prebuilt Addons RFC](https://github.com/ember-cli/rfcs/pull/118). So both of those are alternatives to this one.

Packager creates an escape hatch from the existing ember-cli build that is supposed to provide a foundation for many of the same features enabled by this design. The intention was correct, but in my opinion it tries to decompose the build along the wrong abstraction boundaries. It follows the existing pattern within ember-cli of decomposing the build by feature (all app javacript, all addon javascript, all templates, etc) rather than by package (everything from the app, everything from ember-data, everything from ember-power-select, etc), which puts it into direct conflict with the Prebuilt Addons RFC.

The API that packager provides is also incomplete compared with this design. For example, to take the packager output and build it using Webpack, Rollup, or Parcel still requires a significant amount of custom code. Whereas taking a collection of v2 formatted Ember packages and building them with any of those tools requires very little custom code. TODO: link to hopefully more than one working example.

The prebuilt addons RFC addresses build performance by doing the same kind of work-moving as this design. Addons can do much of their building up front, thus saving time when apps are building. But it only achieves a speedup when apps happen to be using the same build options that addons authors happened to publish. This design takes a different approach that preserves complete freedom for app authors to postprocess all addon Javascript, including dead-code-elimination based on the addon features their app is using. The prebuilt addons RFC also doesn’t attempt to specify the contents of the prebuilt trees — it just accepts the current implementation-defined contents. This is problematic because shared builds artifacts are long-lived, so it’s worth trying to align them with very general, spec-compliant semantics.

# Appendix: Standardized Language Extensions

This spec makes some promises about app-build-time behavior that all v2-formatted addons can rely on. This behavior goes beyond "just Javascript" semantics by making some optimizations mandatory. V2-formatted addons that depend on the following packages get optimization guarantees:

- `@ember/build-time-config`
- `ember-cli-htmlbars-inline-precompile`

The details of each should be described elsewhere in this spec.

# Appendix: List of Ember Package Metadata Fields

## app-js

```
Allowed in: addons
Status: intent to deprecate
```

A path to a directory that should be merged with the app's own namespace. This is a backward-compatibility feature, avoiding using it.

## auto-upgraded

```
Allowed in: apps and addons
Status: internal use only
```

Boolean. Marks a package as having been compiled on the fly from v1 to v2. It's probably not a good idea to ever publish a package to NPM with this set.

## babel.fileFilter

```
Allowed in: apps
Status: encouraged
```

Path to a Javascript file that exports a function for testing (absolute) file paths and returning true if that file should be transpiled by our babel config (as defined by `babel.filename`).

## babel.filename

```
Allowed in: apps
Status: encouraged
```

Path to a Javascript file that exports a babel config.

Note that this is for use in apps, which means in _compiled_ apps that are being handed off for final stage packaging. Mostly this is relevant only to authors of final stage packagers.

## babel.isParallelSafe

```
Allowed in: apps
Status: encouraged
```

Boolean that indicates whether it's safe to load our babel config in a new node process.

## babel.majorVersion

```
Allowed in: apps
Status: encouraged
```

Which babel major version is our babel config expecting to run inside.

## build

```
Allowed in: addons
Status: encouraged
```

Path to a package's build-time hooks file.

## assets

```
Allowed in: apps
Status: encouraged
```

List of paths to files (of any type) that must be present as valid URLs in the final output. HTML files are typical assets, but so is anything that we cannot otherwise rule out. For example: everything in `/public` in a traditional Ember app goes into `assets`, since we can't know if anybody expects them to be remain present on the web.

Note that this is for use in apps, which means in _compiled_ apps that are being handed off for final stage packaging. Mostly this is relevant only to authors of final stage packagers.

## externals

```
Allowed in: addons and apps
Status: intent to deprecate
```

List of module names that are used within the package but not statically build-time resolvable.

This is a backward-compatibility feature that allows us to more efficiently bridge the gap between build-time and run-time resolution.

## fastboot-js

```
Allowed in: addons
Status: intent to deprecate
```

A path to a directory that should be merged with the app's own namespace, but only when running in Fastboot. This is a backward-compatibility feature, avoiding using it. New addons can use the macro system to guard fastboot-only imports.

## implicit-modules

```
Allowed in: addons
Status: intent to deprecate
```

List of paths to Javascript modules that must be resolvable at runtime whenever this package is active.

This is a backward-compatibility feature that's used by the v1-to-v2 compiler.

## implicit-scripts

```
Allowed in: addons
Status: use sparingly
```

List of paths to Javascript files that should be included via `<script>` whenever this package is active. This is effectively a drop-in replacement for the old `app.import()` of JS files.

Instead of using this, prefer to directly import the code you need from the place that needs it. But this may still be needed if you're depending on a legacy library that doesn't work in module context.

## implicit-styles

```
Allowed in: addons
Status: use sparingly
```

List of paths to CSS files that should be included as `<link rel="stylesheet">` whenever this package is active.

Prefer instead to express your dependencies on CSS via ECMA import from the places where it's needed.

## implicit-test-modules

```
Allowed in: addons
Status: intent to deprecate
```

Same as `implicit-modules`, but only within `tests/index.html`.

## implicit-test-scripts

```
Allowed in: addons
Status: use sparingly
```

Same as `implicit-scripts`, but only within `tests/index.html`.

## implicit-test-styles

```
Allowed in: addons
Status: use sparingly
```

Same as `implicit-styles`, but only within `tests/index.html`

## main

```
Allowed in: addons
Status: encouraged
```

This field predates the v2 package spec. It's already used by ember-cli to provide an alternative location for the addon's build-time hooks (as opposed to using the top-level `main` from `package.json`). It's definition is unchanged by this spec: old EmberCLI can keep on using this and finding compatible hooks. v2-aware versions of EmberCLI will ignore this in favor of `build`. Addon authors are encouraged to use this field to allow V2 packages to work in older EmberCLI versions.

## public-assets

```
Allowed in: addons
Status: encouraged
```

This is a mapping from local filenames (relative to the addon's root) to
app-relative-URLs. When a given addon is active, any public-assets will be
available at the corresponding URLs.

## renamed-modules

```
Allowed in: addons
Status: intent to deprecate
```

An object that maps old module names to new module names. Any Ember package that consumes this package will rewrite its own imports to follow these renames.

For example, `ember-qunit` emits a module that is importable as `qunit`, which we capture and rename:

```
"renamed-modules": {
  "qunit/index.js": "ember-qunit/qunit/index.js"
}
```

And then in an app that imports `qunit`, our Babel plugin will rewrite:

```diff
-import QUnit from 'qunit';
+import QUnit from 'ember-qunit/qunit';
```

This is a backward compatibility feature and you should stop doing this. Exposing a module under some other package's name is Not Nice.

## renamed-packages

```
Allowed in: addons
Status: intent to deprecate
```

An object that maps old package names to new package names. Any Ember package that consumes this package will rewrite its own imports to follow these renames.

For example, `ember-lodash` renames itself to `lodash`. When we compile it into a v2 package, we generate:

```
"renamed-packages": {
  "lodash": "ember-lodash"
}
```

And then in an app that depends on `ember-lodash`, our Babel plugin will rewrite:

```diff
-import capitalize from 'lodash/capitalize';
+import capitalize from 'ember-lodash/capitalize';
```

This is a backward compatibility feature and you should stop doing this. Exposing a module under some other package's name is Not Nice.

## resolvable-extensions

```
Allowed in: apps
Status: required
```

A list of file extensions that are considered resolvable as modules. In priority order. Example:

```
"resolvable-extensions": [".ts", ".js", ".hbs"]
```

## root-url

```
Allowed in: apps
Status: encouraged
```

The public URL at which the root of the app will be served. Defaults to '/' when not provided.

## template-compiler.filename

```
Allowed in: apps
Status: encouraged
```

Path to a Javascript file that provides the preconfigured HBS template compiler. Stage3 packagers should grab the `compile` function off the default export and just use that.

Note that this is for use in apps, which means in _compiled_ apps that are being handed off for final stage packaging. Mostly this is relevant only to authors of final stage packagers.

## template-compiler.isParalleSafe

```
Allowed in: apps
Status: encouraged
```

Boolean. Indicates whether this template compiler is safe to use in a new node process.

## version

```
Allowed in: addons and apps
Status: encouraged
```

Identifies that a package is v2 spec compatible.
