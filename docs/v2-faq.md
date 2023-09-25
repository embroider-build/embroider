# Frequently asked questions on v2 addons

## How can I ship CSS with my addon?

The push-based `/styles` folder that v1 addons used to have is not available for v2 addons. Instead, in a pull-based world, you would need to import the CSS. Importing CSS is explicitly supported in the [v2 Addon Format RFC](https://github.com/emberjs/rfcs/pull/507), and means that whenever a module is loaded, the CSS it imports is guaranteed to have been added to the DOM.

Given that your addon's code is only pulled into the app when you import it, your CSS will also only be used when the module importing that is used itself. Therefore, we would recommend to import only the CSS that you need (say for a specific component) in the place where you need it. A common pattern is to colocate the CSS used for a component next to it, and import it from the component's JavaScript module. In case of a template-only component, you can create a JavaScript module for it that exports [templateOnly()](https://api.emberjs.com/ember/5.2/functions/@ember%2Fcomponent%2Ftemplate-only/templateOnly) and import the CSS from there or convert to a `<template>` tag component.

## How can I use `<template>` tag components?

`.gjs`/`.gts` components using the new `<template>` tag syntax require a pre-compilation step. The [@embroider/addon-dev](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/README.md) package provides a rollup plugin for that purpose. In case you don't have that set up yet in your addon's rollup config (assuming you follow the default setup as used by the v2 addon blueprint), you need to add `addon.gjs()` to the list of plugins there. The latest [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint) already comes with the required setup by default.

## How can I lazy-load my addon's code?

Lazy-loading code makes that code not be part of the initial load of the consuming app, but only get loaded later in time when it is actually needed. The means to do that is to not statically import that code, but to use a dynamic `import()`. 

Unlike v1 addons, v2 addons can dynamically import not only external packages but also their own code, like simple modules or even components. You need to make sure though, that these modules are not eagerly loaded elsewhere through static imports. This especially applies to "app re-exports", which basically make the consuming app (statically) import your addon code on your behalf. So when using the common rollup setup with `addon.appReexports()`, make sure the components you want to be able to load lazilly are not covered by the glob patterns supplied to that rollup plugin!

## How can I define the public exports of my addon?

You can explicitly define the public exports, i.e. the modules that consumers of your addon can import. It is useful to restrict these consciously, so users can only import what you define as the public API of your addon and not for example private modules or components that are only used internally or only as yielded contextual components.

To do so, you can specify more restrictive patterns as arguments to the `addon.publicEntrypoints()` plugin used in the default `rollup.config.mjs` of the [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint). Entrypoints here are modules that you want users to import from directly. This allows rollup to optimize all other non-entrypoint modules, e.g. to omit them if they aren't used at all (by any entrypoint), or merge them to a single bundle file. 

For example, when your addon exposes a few components at the root level of `src/components`, while having additional nested components that are only used internally, and maybe some utility functions, you might want to prevent importing the nested components, and expose the utility functions only from your main `index.js` file as re-exports. In this case, your rollup config could look like this:

```js
// rollup.config.mjs
addon.publicEntrypoints('index.js', 'components/*.js'),
```

Additionally, there is a feature supported in node.js and modern bundlers to define an `exports` key in your `package.json` with a mapping of export paths to the actual files on disk, that lets you further tweak or constrain your public exports. This is explained in more detail [here](https://nodejs.org/api/packages.html#exports).

## How can I write code depending on the context of the app or its dependencies?

v2 addons are static packages, that do not integrate with the app's build, thus cannot know anything about the app, its context or its dependencies ahead of time.

For the rare cases where you really need to know something about the app to be able to do the right thing, there is an escape hatch in the form of the `@embroider/macros` package, which is a set of macros that are able to transform your code at build-time of the app. Please refer to its [documentation](../packages/macros/README.md).
