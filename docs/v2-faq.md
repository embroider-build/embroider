# Frequently asked questions on v2 addons

<!-- Run `npx markdown-toc -i docs/v2-faq.md` to update the TOC here >

<!-- toc -->

- [Authoring](#authoring)
  * [How can I use template tag components?](#how-can-i-use-template-tag-components)
  * [How do I import my addon's own modules?](#how-do-i-import-my-addons-own-modules)
  * [How can I lazy-load my addon's code?](#how-can-i-lazy-load-my-addons-code)
  * [How can I write code depending on the context of the app or its dependencies?](#how-can-i-write-code-depending-on-the-context-of-the-app-or-its-dependencies)
- [Asset handling](#asset-handling)
  * [How can I ship CSS with my addon?](#how-can-i-ship-css-with-my-addon)
  * [How can I ship other static assets with my addon?](#how-can-i-ship-other-static-assets-with-my-addon)
  * [How can I "push" static assets into the app?](#how-can-i-push-static-assets-into-the-app)
- [Build setup](#build-setup)
  * [Why do v2 addons need a build step?](#why-do-v2-addons-need-a-build-step)
  * [How can I integrate with the app's build?](#how-can-i-integrate-with-the-apps-build)
  * [How can I define the public exports of my addon?](#how-can-i-define-the-public-exports-of-my-addon)

<!-- tocstop -->

## Authoring 

### How can I use template tag components?

`.gjs`/`.gts` components using the new `<template>` tag syntax require a pre-compilation step. The [@embroider/addon-dev](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/README.md) package provides a rollup plugin for that purpose. In case you don't have that set up yet in your addon's rollup config (assuming you follow the default setup as used by the v2 addon blueprint), you need to add `addon.gjs()` to the list of plugins there. The latest [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint) already comes with the required setup by default.

### How do I import my addon's own modules?

Make sure that you import from your own addon's modules by
* using relative paths. While v1 addons could self-reference their own package name, doing so in v2 addons is subject to resolving through `package.json#exports` as [node does](https://nodejs.org/api/packages.html#self-referencing-a-package-using-its-name), and as such it is recommended in general to use relative imports only.
* including the file extension in the import path so that rollup knows which set of plugins to run over the file.

```ts
import { Something } from './path/to/file.ts';
```

If you've done ESM in node, this should feel familiar, and we can be be consistent with JS imports as well:

```js
import { AnotherThing } from './path/to/file.js';
```

Generally, import:
- gjs with `./path/to/file.gjs`
- gts with `./path/to/file.gts`
- js with `./path/to/file.js`
- ts with `./path/to/file.ts`
- hbs with `./path/to/file.js` or `./path/to/file`

A couple caveats with older, co-located components,
 - for `.hbs` / template-only components, no extension is needed, but the js extension can be used.
 - for co-located components, where the template is in a separate `.hbs` file, you may not import that `.hbs` file directly, because it is merged in with the associated `.js` or `.ts` file.

For consumers of your library, they will not need to worry about the extensions, because:
- rollup compiles away the implementation details (non-js modules)
- package.json#exports declares what is importable under what path, and maps non-extension imports to files with extensions

### How can I lazy-load my addon's code?

Lazy-loading code makes that code not be part of the initial load of the consuming app, but only get loaded later in time when it is actually needed. The means to do that is to not statically import that code, but to use a dynamic `import()`. 

Unlike v1 addons, v2 addons can dynamically import not only external packages but also their own code, like simple modules or even components. You need to make sure though, that these modules are not eagerly loaded elsewhere through static imports. This especially applies to "app re-exports", which basically make the consuming app (statically) import your addon code on your behalf. So when using the common rollup setup with `addon.appReexports()`, make sure the components you want to be able to load lazilly are not covered by the glob patterns supplied to that rollup plugin!


### How can I write code depending on the context of the app or its dependencies?

v2 addons are static packages, that do not integrate with the app's build, thus cannot know anything about the app, its context or its dependencies ahead of time.

For the rare cases where you really need to know something about the app to be able to do the right thing, there is an escape hatch in the form of the `@embroider/macros` package, which is a set of macros that are able to transform your code at build-time of the app. Please refer to its [documentation](../packages/macros/README.md).

## Asset handling

### How can I ship CSS with my addon?

The push-based `/styles` folder that v1 addons used to have is not available for v2 addons. Instead, in a pull-based world, you would need to import the CSS. Importing CSS is explicitly supported in the [v2 Addon Format RFC](https://github.com/emberjs/rfcs/pull/507), and means that whenever a module is loaded, the CSS it imports is guaranteed to have been added to the DOM.

Given that your addon's code is only pulled into the app when you import it, your CSS will also only be used when the module importing that is used itself. Therefore, we would recommend to import only the CSS that you need (say for a specific component) in the place where you need it. A common pattern is to colocate the CSS used for a component next to it, and import it from the component's JavaScript module. In case of a template-only component, you can create a JavaScript module for it that exports [templateOnly()](https://api.emberjs.com/ember/5.2/functions/@ember%2Fcomponent%2Ftemplate-only/templateOnly) and import the CSS from there or convert to a `<template>` tag component.

### How can I ship other static assets with my addon?

Similarily to the way we can ship CSS, we can do the same for other static assets like images by importing them. 
Let's say an addon wants to ship an SVG file and refer to it in a component:

```js
import logo from '../assets/logo.svg';

<template>
  <img src={{logo}} alt='ACME' />
</template>
```

Contrary to the CSS example, this is now not a side-effect only import anymore, but we actually get a value back as the default export of that imported asset: its public URL in the final build output. That's why we can pass this as the value of the `src` attribute in the example above.

A few caveats though! 

First, the ability to import static assets other than CSS is not enabled by default it Ember apps yet. So any Ember app that follows this pattern itself, or consumes a v2 addon doing this, will need to get this set up correctly first. To do so, the user would have to add a module rule to their webpack config, that configures [assets modules](https://webpack.js.org/guides/asset-modules/) for the given file extension(s):

```js
module: {
  rules: [
    {
      test: /\.(svg)$/i,
      type: 'asset/resource', // could also be just 'asset', if you want to have small assets be inlined
    },
  ],
}
```

This would either go into the `autoImport.webpack` part of the [`ember-auto-import` config](https://github.com/embroider-build/ember-auto-import#customizing-build-behavior) for classic builds, or into the `packagerOptions.webpackConfig` part of the [Embroider compat options](https://github.com/embroider-build/embroider#options).

> Note that [RFC763](https://github.com/emberjs/rfcs/pull/763), once it lands, will make this manual setup obsolete, but might also change _slightly_ the way you specify the asset imports.

Furthermore, when using the default v2 addon blueprint and its Rollup config, make sure that the `keepAssets` plugin includes the file extensions that you want to import in your addon:


```js
// rollup.config.mjs
addon.keepAssets(['**/*.css', '**/*.svg']),
```

Lastly, make sure that the only way you refer to the assets is by using the value returned from the import statement, and _not_ assume what the final URL would be. The bundler is free to choose the final URL, as (depending on your config) it will likely apply some fingerprinting (replacing the legacy `broccoli-asset-rev`), or even choose to inline the asset data (when using `type: 'asset'` in the module rule definition).

### How can I "push" static assets into the app?

Another way to provide the consuming app with static assets from your addon is a push-based approach very similar to the `/public` folder of v1 addons. While the pull-based approach above is preferable in general, in cases where you for example do not need to refer to the asset directly, but want to have a predetermined URL, you can choose the push-based approach instead.

This is done by adding some meta data to the addon's `package.json`, specifying a mapping from the addon's file location to the final public URL, as specified in the [v2 addon spec](https://rfcs.emberjs.com/id/0507-embroider-v2-package-format#assets). Let's say an addon wants to provide a favicon file (which browsers will automatically request from the static `/favicon.ico` URL):

```json
{
 "ember-addon": {
    "version": 2,
    "type": "addon",
    "main": "addon-main.cjs",
    "public-assets": {
      "./src/assets/public/favicon.ico": "/favicon.ico"
    }
  }
}
```
 
If you have many files you want to expose this way, you can instead add the `addon.publicAssets()` plugin from `@embroider/addon-dev` to your Rollup config to automate the generation of this mapping data. This rollup plugin will automatically prefix your public assets with a folder name that matches your addon packages name, this is to prevent any name clashes between addons. You can read more about it in the docs for the addon-dev rollup plugin utilities https://github.com/embroider-build/embroider/tree/main/packages/addon-dev#rollup-utilities


## Build setup

### Why do v2 addons need a build step?

The [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint) uses [Rollup](https://rollupjs.org/) for assembling and transpiling your code in to a native npm package that can be imported from anywhere.

While having a build step is not strictly required for v2 addons, there are a few reasons we would want it in general nevertheless:
- use of pre-shipped JS features (decorators, and other in-progress ECMA proposals)
- use of TypeScript
- co-located components are not modules-by-default

The important thing to remember here though is that this build step is very different from the build integration that v1 addons allow! While v1 addons integrate as build-plugins with the app's build and as such all add a bit of overhead to it, the build step of v2 addons happens ahead of time, before they are published to npm. So at the time they are consumed by the app, they are fully static and do _not_ plug into the app's build system.

### How can I integrate with the app's build?

If you really need to add behaviour to the app's build that your addon needs to rely on, the way to go is to provide a plugin to the bundler used by the app (through `ember-auto-import` in a classic build or Embroider), which for now will most likely be [Webpack](https://webpack.js.org/).

If all you need to do is to convert some file your app is supposed to import that is not JavaScript to actual JavaScript, then that's the perfect use case for [Webpack Loaders](https://webpack.js.org/concepts/loaders/), which have a much simplified API compared to a full-fledged plugin. 

The recommnedad setup would be to provide that plugin or loader as a separate package within your addon's monorepo like for example `@my-addon/webpack`. You can then instruct your users to add the required webpack config to their app's config similar as with the [static assets pattern](#how-can-i-ship-other-static-assets-with-my-addon):

```js
module: {
  rules: [
    {
      test: /\.ya?ml$/i, // make this match what files you want to get imported through your loader
      use: '@my-addon/webpack', 
    },
  ],
}
```

### How can I define the public exports of my addon?

You can explicitly define the public exports, i.e. the modules that consumers of your addon can import. It is useful to restrict these consciously, so users can only import what you define as the public API of your addon and not for example private modules or components that are only used internally or only as yielded contextual components.

To do so, you can specify more restrictive patterns as arguments to the `addon.publicEntrypoints()` plugin used in the default `rollup.config.mjs` of the [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint). Entrypoints here are modules that you want users to import from directly. This allows rollup to optimize all other non-entrypoint modules, e.g. to omit them if they aren't used at all (by any entrypoint), or merge them to a single bundle file. 

For example, when your addon exposes a few components at the root level of `src/components`, while having additional nested components that are only used internally, and maybe some utility functions, you might want to prevent importing the nested components, and expose the utility functions only from your main `index.js` file as re-exports. In this case, your rollup config could look like this:

```js
// rollup.config.mjs
addon.publicEntrypoints('index.js', 'components/*.js'),
```

Additionally, there is a feature supported in node.js and modern bundlers to define an `exports` key in your `package.json` with a mapping of export paths to the actual files on disk, that lets you further tweak or constrain your public exports. This is explained in more detail here:
- https://nodejs.org/api/packages.html#package-entry-points
- https://webpack.js.org/guides/package-exports/

When using `package.json#exports` make sure that:
- the `addon.publicEntrypoints(...)` plugin in `rollup.config.mjs` includes _at least_ whatever is defined in `package.json#exports`
- the modules that `addon.appReexports(...)` exposes must have overlap with the `package.json#exports` so that the app-tree merging may import from the addon
