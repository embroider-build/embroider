import Application from '@ember/application';
import Resolver from 'ember-resolver';
import config from './config/environment';
import compatModules from '@embroider/virtual/compat-modules';

/**
 * TODO remove this. Apparently ember-test-helpers depends on this global existing or else it crashes
 * and apparently we don't introduce this global any more in the pure minimal app.
 *
 * Also interesting observation: as an Ember develop you probably won't notice this error when developing locally
 * since you probably have the Ember Inspector installed and the Ember inspector **introduces** this global by
 * just being installed 😭 I only figured this out when running testem in dev mode which opens a new instance of
 * chrome with no extensions installed 🫠
 */
globalThis.EmberENV = {};

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules(compatModules);
}
