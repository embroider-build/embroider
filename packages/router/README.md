# @embroider/router

A tiny extension to the stock Ember Router that detects the presence
of lazy route bundles and loads them when needed.

## Compatibility

To get code-splitting, your app must build with Embroider. It's safe to use
this router in apps that aren't building with Embroider, but it won't do
anything.

## Installation

```
ember install @embroider/router
```

In your `router.js` file, import our router instead of the stock one:

```diff
-import EmberRouter from '@ember/routing/router';
+import EmberRouter from '@embroider/router';
```

## License

This project is licensed under the [MIT License](LICENSE.md).
