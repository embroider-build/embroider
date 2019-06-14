/*
  This code is adapted from ember-engines/addon/-private/router-ext.js.
*/
import EmberRouter from '@ember/routing/router';
import { registerWaiter } from '@ember/test';

let newSetup = true;

function lazyBundle(routeName) {
  if (!window._embroiderRouteBundles_) {
    return false;
  }
  return window._embroiderRouteBundles_.find(bundle => bundle.names.indexOf(routeName) !== -1);
}

export default EmberRouter.extend({
  init(...args) {
    this._super(...args);
    this._inFlightLazyRoutes = 0;
    registerWaiter(this._doneLoadingLazyRoutes.bind(this));
  },

  // This is necessary in order to prevent the premature loading of lazy routes
  // when we are merely trying to render a link-to that points at them.
  // Unfortunately the stock query parameter behavior pulls on routes just to
  // check what their previous QP values were.
  _getQPMeta(handlerInfo) {
    let bundle = lazyBundle(handlerInfo.name);
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
    if (newSetup) {
      // Different versions of routerMicrolib use the names `getRoute` vs
      // `getHandler`.
      if (this._routerMicrolib.getRoute !== undefined) {
        this._routerMicrolib.getRoute = this._handlerResolver(this._routerMicrolib.getRoute.bind(this._routerMicrolib));
      } else if (this._routerMicrolib.getHandler !== undefined) {
        this._routerMicrolib.getHandler = this._handlerResolver(
          this._routerMicrolib.getHandler.bind(this._routerMicrolib)
        );
      }
    }
    return isSetup;
  },

  _handlerResolver(original) {
    return name => {
      let bundle = lazyBundle(name);
      if (!bundle || bundle.loaded) {
        return original(name);
      }
      this._inFlightLazyRoutes++;
      return bundle.load().then(
        () => {
          this._inFlightLazyRoutes--;
          bundle.loaded = true;
          return original(name);
        },
        err => {
          this._inFlightLazyRoutes--;
          throw err;
        }
      );
    };
  },

  _doneLoadingLazyRoutes() {
    return this._inFlightLazyRoutes < 1;
  },
});
