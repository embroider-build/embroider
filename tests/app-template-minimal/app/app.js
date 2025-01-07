import Application from '@ember/application';
import Resolver from 'ember-resolver';
import config from './config/environment';

const templates = import.meta.glob(`./templates/**/*.gjs`, {
  eager: true,
});

// TODO: we need nice API here
function mangle(templates) {
  return Object.fromEntries(
    Object.entries(templates).map(([k, v]) => [
      k.replace(/\.gjs$/, '').replace(/^\.\//, 'app-template-minimal/'),
      v,
    ])
  );
}

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules({
    ...mangle(templates),
  });
}
