import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from 'vite-app/config/environment';

// this is needed because of an issue with the dependency discovery in vite
// where it is not picking up the dependencies of the gjs file because vite
// never even asks the dependency discovery code to load this file. We
// suspect that it has got something to do with the fact that the rewritten
// app is in node_modules so we will revisit this once we have killed the
// need for a rewritten_app
import 'vite-app/components/fancy.gjs';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
