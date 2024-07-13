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

let Router: typeof EmberRouter;

interface GetRoute {
  (name: string): ReturnType<EmberRouter['_routerMicrolib']['getRoute']>;
  isEmbroiderRouterHandler?: true;
}

interface Internals {
  _engineInfoByRoute: Record<string, { name: string }>;
  _routerMicrolib: {
    getRoute: GetRoute;
  };
}

interface EmbroiderBundle {
  names: string[];
  loaded?: true;
  load: () => Promise<void>;
}

if (macroCondition(getGlobalConfig<GlobalConfig>()['@embroider/core']?.active ?? false)) {
  const waiter = buildWaiter('@embroider/router:lazy-route-waiter');

  function embroiderBundles(): {
    _embroiderEngineBundles_?: EmbroiderBundle[];
    _embroiderRouteBundles_?: EmbroiderBundle[];
  } {
    return window as ReturnType<typeof embroiderBundles>;
  }

  class EmbroiderRouter extends EmberRouter {
    private seenByRoute = new Set<string>();

    private lazyRoute(this: this & Internals, routeName: string): EmbroiderBundle | undefined {
      let bundles = embroiderBundles();
      if (bundles._embroiderRouteBundles_) {
        return bundles._embroiderRouteBundles_.find(bundle => bundle.names.indexOf(routeName) !== -1);
      }
      return undefined;
    }

    private lazyEngine(this: this & Internals, routeName: string): EmbroiderBundle | undefined {
      // Here we map engine names to route names. We need to do this because
      // engines can be specified with "as" such as:
      //
      // this.mount('lazy-engine', { path: '/use-lazy-engine', as: 'use-lazy-engine' });
      //
      // This presents a problem at build time since we cant get this "mount point" name. This is because the
      // router is dynamic and the string could be defined as anything. Luckly, this._engineInfoByRoute contains
      // mappings from routeName to the engines "original name" (which we know at build time).
      let bundles = embroiderBundles();
      let engine = this._engineInfoByRoute[routeName];
      if (engine && bundles._embroiderEngineBundles_) {
        let engineName = engine.name;
        return bundles._embroiderEngineBundles_.find(bundle => bundle.names.indexOf(engineName) !== -1);
      }
      return undefined;
    }

    private isEngine(this: this & Internals, name: string): boolean {
      return Boolean(this._engineInfoByRoute[name]);
    }

    // This is necessary in order to prevent the premature loading of lazy routes
    // when we are merely trying to render a link-to that points at them.
    // Unfortunately the stock query parameter behavior pulls on routes just to
    // check what their previous QP values were.
    _getQPMeta(this: this & Internals, handlerInfo: { name: string }, ...rest: unknown[]) {
      let bundle = this.lazyRoute(handlerInfo.name);
      if (bundle && !bundle.loaded) {
        // unloaded split routes
        return undefined;
      }

      if (this.isEngine(handlerInfo.name) && !this.seenByRoute.has(handlerInfo.name)) {
        // unvisited engines, whether loaded or not, because the same bundle
        // could by mounted multiple places and engines expect to only run the
        // super._getQPMeta after they've been visited.
        return undefined;
      }

      bundle = this.lazyEngine(handlerInfo.name);
      if (bundle && !bundle.loaded) {
        // unloaded lazy engines
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

    private _handlerResolver(this: this & Internals, original: (name: string) => unknown) {
      let handler = ((name: string) => {
        const bundle = this.lazyRoute(name) ?? this.lazyEngine(name);
        this.seenByRoute.add(name);
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
