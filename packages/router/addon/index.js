/*
  This cod- is adapted from ember-engines/addon/-private/router-ext.js.
*/
import EmberRouter from '@ember/routing/router';
import { waitForPromise } from '@ember/test-waiters';
import { macroCondition, getGlobalConfig } from '@embroider/macros';

let Router;

if (macroCondition(getGlobalConfig()['@embroider/core']?.active)) {
  let newSetup = true;

  const lazyBundle = function (routeName, engineInfoByRoute) {
    // Here we map engine names to route names. We need to do this because
    // engines can be specified with "as" such as:
    //
    // this.mount('lazy-engine', { path: '/use-lazy-engine', as: 'use-lazy-engine' });
    //
    // This presents a problem at build time since we cant get this "mount point" name. This is because the
    // router is dynamic and the string could be defined as anything. Luckly, this._engineInfoByRoute contains
    // mappings from routeName to the engines "original name" (which we know at build time).
    let engine = engineInfoByRoute[routeName];
    if (engine && window._embroiderEngineBundles_) {
      return window._embroiderEngineBundles_.find(
        (bundle) => bundle.names.indexOf(engine.name) !== -1
      );
    }

    if (window._embroiderRouteBundles_) {
      return window._embroiderRouteBundles_.find(
        (bundle) => bundle.names.indexOf(routeName) !== -1
      );
    }

    return false;
  };

  // eslint-disable-next-line ember/no-classic-classes
  Router = EmberRouter.extend({
    // This is necessary in order to prevent the premature loading of lazy routes
    // when we are merely trying to render a link-to that points at them.
    // Unfortunately the stock query parameter behavior pulls on routes just to
    // check what their previous QP values were.
    _getQPMeta(handlerInfo) {
      let bundle = lazyBundle(handlerInfo.name, this._engineInfoByRoute);
      if (bundle && !bundle.loaded) {
        return undefined;
      }
      return this._super(...arguments);
    },

    // On older versions of Ember, this is a framework method that we're
    // overriding to provide our own handlerResolver.
    _getHandlerFunction() {
      newSetup = false;
      return this._handlerResolver();
    },

    // On newer versions of Ember, this is the framework method that we're
    // overriding to provide our own handlerResolver.
    setupRouter() {
      let isSetup = this._super(...arguments);

      // eslint-disable-next-line ember/no-private-routing-service
      const routerMicrolib = this._routerMicrolib;
      if (newSetup) {
        // Different versions of routerMicrolib use the names `getRoute` vs
        // `getHandler`.
        if (routerMicrolib.getRoute !== undefined) {
          routerMicrolib.getRoute = this._handlerResolver(
            routerMicrolib.getRoute.bind(routerMicrolib)
          );
        } else if (routerMicrolib.getHandler !== undefined) {
          routerMicrolib.getHandler = this._handlerResolver(
            routerMicrolib.getHandler.bind(routerMicrolib)
          );
        }
      }
      return isSetup;
    },

    _handlerResolver(original) {
      return (name) => {
        let bundle = lazyBundle(name, this._engineInfoByRoute);
        if (!bundle || bundle.loaded) {
          return original(name);
        }
        return waitForPromise(
          (async () => {
            await bundle.load();
            bundle.loaded = true;
            return original(name);
          })(),
          'embroider:lazy-routes'
        );
      };
    },
  });
} else {
  Router = EmberRouter;
}

export default Router;
