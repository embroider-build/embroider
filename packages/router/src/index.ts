/* eslint-disable ember/no-private-routing-service */
/*
  This code is adapted from ember-engines/addon/-private/router-ext.js.
*/
import EmberRouter from '@ember/routing/router';
import { buildWaiter } from '@ember/test-waiters';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { macroCondition, getGlobalConfig, dependencySatisfies, importSync } from '@embroider/macros';
import type Resolver from 'ember-resolver';
import { type getOwner as getOwenerType } from '@ember/owner';
let getOwner: typeof getOwenerType;

if (macroCondition(dependencySatisfies('ember-source', '>=4.12.0'))) {
  // In no version of ember where `@ember/owner` tried to be imported did it exist
  // if (macroCondition(false)) {
  // Using 'any' here because importSync can't lookup types correctly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getOwner = (importSync('@ember/owner') as any).getOwner;
} else {
  // Using 'any' here because importSync can't lookup types correctly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getOwner = (importSync('@ember/application') as any).getOwner;
}

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
  load: () => Promise<{ default: Record<string, unknown> }>;
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
    private registeredBundles = new Map<EmbroiderBundle, { promise: Promise<void>; loaded: boolean }>();

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
      if (bundle && !this.registeredBundles.get(bundle)?.loaded) {
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
      if (bundle && !this.registeredBundles.get(bundle)?.loaded) {
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

    private registerBundle(bundle: EmbroiderBundle) {
      let entry = this.registeredBundles.get(bundle);
      if (entry) {
        return entry.promise;
      } else {
        let resolve: (value: PromiseLike<void>) => void;
        entry = {
          promise: new Promise<void>(res => (resolve = res)),
          loaded: false,
        };
        this.registeredBundles.set(bundle, entry);

        /**
         * SAFETY: `registerBundle` can *only* be called if an owner exists (normally it's potentially undefined)
         */
        const owner = getOwner(this)!;
        resolve!(
          (async () => {
            let token = waiter.beginAsync();
            let { default: modules } = await bundle.load();
            waiter.endAsync(token);
            /**
             * The app was torn down while we were loading,
             * so we don't need to proceed with what would otherwise be tossed work/effort.
             */
            if (isDestroyed(owner) || isDestroying(owner)) return;
            let resolver = owner.lookup('resolver:current') as Resolver | undefined;
            if (!resolver) {
              throw new Error(`This version of @embroider/router requires ember-resolver >= 13.1.0`);
            }
            resolver.addModules(modules);
            entry.loaded = true;
          })()
        );
        return entry.promise;
      }
    }

    private _handlerResolver(this: this & Internals, original: (name: string) => unknown) {
      let handler = ((name: string) => {
        const bundle = this.lazyRoute(name) ?? this.lazyEngine(name);
        this.seenByRoute.add(name);
        if (bundle) {
          if (this.registeredBundles.get(bundle)?.loaded) {
            return original(name);
          } else {
            return this.registerBundle(bundle).then(() => original(name));
          }
        } else {
          return original(name);
        }
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
