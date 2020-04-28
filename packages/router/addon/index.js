/*
  This code is adapted from ember-engines/addon/-private/router-ext.js.
*/
import EmberRouter from '@ember/routing/router';
import { registerWaiter, unregisterWaiter } from '@ember/test';
import { DEBUG } from '@glimmer/env';

let newSetup = true;

function lazyBundle(routeName, engineInfoByRoute) {
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
    return window._embroiderEngineBundles_.find(bundle => bundle.names.indexOf(engine.name) !== -1);
  }

  if (window._embroiderRouteBundles_) {
    return window._embroiderRouteBundles_.find(bundle => bundle.names.indexOf(routeName) !== -1);
  }

  return false;
}

function isEmberEngineOverridingRouter() {
  // This router is intended to work with both classical and embroider
  // builds. Currently, this collides with ember-engines/-private/router-ext's
  // overrides. To overcome this, during embroider builds we remove that file
  // from being included as apart of the build (and thus will not reopen the class).
  // However, during classical builds this is not possible so here we check if that
  // module is included and if it is we know that we are in a classical build and
  // that the router is being reopened. If it is being reopened then we can simply
  // call into ember-engines router as we dont need to do anything.

  // eslint-disable-next-line no-undef
  return !!requirejs.entries['ember-engines/-private/router-ext'];
}

let Router = EmberRouter.extend({
  init(...args) {
    this._super(...args);
    this._inFlightLazyRoutes = 0;
  },

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

    if (newSetup && !isEmberEngineOverridingRouter()) {
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
    if (isEmberEngineOverridingRouter()) {
      // use ember engines handler since we are in a classical
      // build
      return this._super(...arguments);
    }

    return name => {
      let bundle = lazyBundle(name, this._engineInfoByRoute);
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
});

if (DEBUG) {
  Router.reopen({
    init(...args) {
      this._super(...args);
      this._doneLoadingLazyRoutes = () => this._inFlightLazyRoutes < 1;
      registerWaiter(this._doneLoadingLazyRoutes);
    },
    willDestroy() {
      unregisterWaiter(this._doneLoadingLazyRoutes);
    },
  });
}

export default Router;
