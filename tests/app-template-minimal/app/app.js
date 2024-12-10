import Application from '@ember/application';
import Resolver from 'ember-resolver';
import config from './config/environment';

const templates = import.meta.glob(`./templates/**/*`, { eager: true });

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules({
    ...templates,
  });
}
