import Application from '@ember/application';
import compatModules from '@embroider/core/entrypoint';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from 'ts-app-template/config/environment';

let d = window.define;

for (const [name, module] of Object.entries(compatModules)) {
  d(name, function () {
    return module;
  });
}

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
