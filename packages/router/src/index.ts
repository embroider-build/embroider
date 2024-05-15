/* eslint-disable ember/no-private-routing-service */
/*
  This code is adapted from ember-engines/addon/-private/router-ext.js.
*/
import EmberRouter from '@ember/routing/router';
import { buildWaiter } from '@ember/test-waiters';
import { macroCondition, getGlobalConfig } from '@embroider/macros';

interface GlobalConfig {
  '@embroider/core'?: { active: boolean };
}

type EngineInfoByRoute = Record<string, { name: string }>;

let Router: typeof EmberRouter;

interface GetRoute {
  (name: string): ReturnType<EmberRouter['_routerMicrolib']['getRoute']>;
  isEmbroiderRouterHandler?: true;
}

interface Internals {
  _routerMicrolib: {
    getRoute: GetRoute;
  };
}

if (macroCondition(getGlobalConfig<GlobalConfig>()['@embroider/core']?.active ?? false)) {
  const waiter = buildWaiter('@embroider/router:lazy-route-waiter');

  function embroiderBundles(): {
    _embroiderEngineBundles_?: { names: string[]; loaded?: true; load: () => Promise<void> }[];
    _embroiderRouteBundles_?: { names: string[]; loaded?: true; load: () => Promise<void> }[];
  } {
    return window as ReturnType<typeof embroiderBundles>;
  }

  class EmbroiderRouter extends EmberRouter {
    private lazyBundle(routeName: string) {
      let engineInfoByRoute = (this as unknown as { _engineInfoByRoute: EngineInfoByRoute })._engineInfoByRoute;

      // Here we map engine names to route names. We need to do this because
      // engines can be specified with "as" such as:
      //
      // this.mount('lazy-engine', { path: '/use-lazy-engine', as: 'use-lazy-engine' });
      //
      // This presents a problem at build time since we cant get this "mount point" name. This is because the
      // router is dynamic and the string could be defined as anything. Luckly, this._engineInfoByRoute contains
      // mappings from routeName to the engines "original name" (which we know at build time).
      let bundles = embroiderBundles();
      let engine = engineInfoByRoute[routeName];
      if (engine && bundles._embroiderEngineBundles_) {
        let engineName = engine.name;
        return bundles._embroiderEngineBundles_.find(bundle => bundle.names.indexOf(engineName) !== -1);
      }

      if (bundles._embroiderRouteBundles_) {
        return bundles._embroiderRouteBundles_.find(bundle => bundle.names.indexOf(routeName) !== -1);
      }

      return false;
    }

    // This is necessary in order to prevent the premature loading of lazy routes
    // when we are merely trying to render a link-to that points at them.
    // Unfortunately the stock query parameter behavior pulls on routes just to
    // check what their previous QP values were.
    _getQPMeta(handlerInfo: { name: string }, ...rest: unknown[]) {
      let bundle = this.lazyBundle(handlerInfo.name);
      if (bundle && !bundle.loaded) {
        return undefined;
      }
      // @ts-expect-error extending private method
      return super._getQPMeta(handlerInfo, ...rest);
    }

    // This is the framework method that we're overriding to provide our own
    // handlerResolver.
    setupRouter(this: this & Internals, ...args: unknown[]) {
      // @ts-expect-error extending private method
      let isSetup = super.setupRouter(...args);
      let microLib = this._routerMicrolib;
      if (!microLib.getRoute.isEmbroiderRouterHandler) {
        microLib.getRoute = this._handlerResolver(microLib.getRoute.bind(microLib));
      }
      return isSetup;
    }

    private _handlerResolver(original: (name: string) => unknown) {
      let handler = ((name: string) => {
        const bundle = this.lazyBundle(name);
        if (!bundle || bundle.loaded) {
          return original(name);
        }

        let token = waiter.beginAsync();

        return bundle.load().then(
          () => {
            waiter.endAsync(token);
            bundle.loaded = true;
            return original(name);
          },
          err => {
            waiter.endAsync(token);
            throw err;
          }
        );
      }) as GetRoute;
      handler.isEmbroiderRouterHandler = true;
      return handler;
    }
  }

  Router = EmbroiderRouter;
} else {
  Router = EmberRouter;
}

export default Router;
