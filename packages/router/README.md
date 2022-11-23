# @embroider/router

A tiny extension to the stock Ember Router that detects the presence
of lazy route bundles and loads them when needed.

## Compatibility

- Ember.js v3.28 or above
- Ember CLI v3.28 or above
- Node.js v16 or above

To get code-splitting, your app must build with Embroider. It's safe to use
this router in apps that aren't building with Embroider, but it won't do
anything.

## Limitations

### Route "serialize" hook Not Supported

When using lazily-loaded routes, the `serialize` hook on `Route` is not supported, because this would require us to load a `Route` when someone is only linking to it, not actually visiting it.

### Route Unit Tests may need to be updated

Once you enable lazy loading of routes, any Route unit tests that try to `lookup('route:your-route-name')` can fail because the route is not necessarily loaded. You can adjust your tests to explicitly import and register the Route:

```diff
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
+ import ExampleRoute from 'your-app/routes/example';

module('Unit | Route | example', function (hooks) {
  setupTest(hooks);

+ hooks.beforeEach(function () {
+   this.owner.register('route:example', ExampleRoute);
+ });

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:example');
    assert.ok(route);
  });
});
```

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
