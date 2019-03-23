import EmberRouter from '@ember/routing/router';
import { getOwner } from '@ember/application';

/*
  This code is adapted from ember-engines/addon/-private/router-ext.js. Some of
  the comments on compatibility are taken verbtaim from there.
*/

// This needed because we need to infer the setup of the router.js Prior to
// https://github.com/emberjs/ember.js/pull/16974 we used to call
// `_getHandlerFunction` to get the closed over function to resolve a name to a
// handler. PR#16974 removed this private method.
let newSetup = true;

export default EmberRouter.extend({
  // Handle the case where somebody tries to load query params for a route that
  // we've never entered or loaded yet.
  _getQPMeta(handlerInfo) {
    let routeName = handlerInfo.name;
    let isWithinEngine = this._engineInfoByRoute[routeName];
    let hasBeenLoaded = this._seenHandlers[routeName];
    if (isWithinEngine && !hasBeenLoaded) {
      return undefined;
    }
    return this._super(...arguments);
  },

  _getHandlerFunction() {
    newSetup = false;
    return this._handlerResolver();
  },

  setupRouter() {
    let isSetup = this._super(...arguments);
    if (newSetup) {
      // This method used to be called `getHandler` and it is going to be called `getRoute`.
      if (this._routerMicrolib.getRoute !== undefined) {
        this._routerMicrolib.getRoute = this._handlerResolver();
      } else if (this._routerMicrolib.getHandler !== undefined) {
        this._routerMicrolib.getHandler = this._handlerResolver();
      }
    }
    return isSetup;
  },

  _handlerResolver() {
    let seen = this._seenHandlers;
    let owner = getOwner(this);
    return name => {
      let engineInfo = this._engineInfoByRoute[name];
      if (engineInfo) {
        let engineInstance = this._getEngineInstance(engineInfo);
        if (engineInstance) {
          return this._getHandlerForEngine(seen, name, engineInfo.localFullName, engineInstance);
        } else {
          return this._loadEngineInstance(engineInfo).then(instance => {
            return this._getHandlerForEngine(seen, name, engineInfo.localFullName, instance);
          });
        }
      }

      // If we don't cross into an Engine, then the routeName and localRouteName
      // are the same.
      return this._internalGetHandler(seen, name, name, owner);
    };
  },
});
