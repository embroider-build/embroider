# @embroider/router

A tiny extension to the stock Ember Router that detects the presence
of lazy route bundles and loads them when needed.

## Compatibility

- Ember.js v3.16 or above
- Ember CLI v3.16 or above
- Node.js v12 or above

To get code-splitting, your app must build with Embroider. It's safe to use
this router in apps that aren't building with Embroider, but it won't do
anything.

When using lazily-loaded routes, the `serialize` hook on `Route` is not supported, because this would require us to load a `Route` when someone is only linking to it, not actually visiting it.

## Installation

```
ember install @embroider/router
```

In your `router.js` file, import our router instead of the stock one:

```diff
-import EmberRouter from '@ember/routing/router';
+import EmberRouter from '@embroider/router';
```

## Notes on usage with pods

If you use the pod file layout for your routes, you have to make sure to set a non-undefined `podModulePrefix` in your `config/environment.js`. `podModulePrefix: ''` is also allowed. Otherwise, your pod routes will not be picked up by Embroider.

## License

This project is licensed under the [MIT License](LICENSE.md).
