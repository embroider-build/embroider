import Application from '@ember/application';
// Disabled because dummy apps are invalid packages
// (and we have a package.json in tests/dummy, which has no deps)
// eslint-disable-next-line n/no-extraneous-import
import Resolver from 'ember-resolver';
// Disabled because dummy apps are invalid packages
// (and we have a package.json in tests/dummy, which has no deps)
// eslint-disable-next-line n/no-extraneous-import
import loadInitializers from 'ember-load-initializers';
import config from 'dummy/config/environment';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
