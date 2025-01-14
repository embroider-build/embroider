import Application from '@ember/application';
import Resolver from 'ember-resolver';
import Router from './router';
import config from './config/environment';

const templates = import.meta.glob(`./templates/**/*.gjs`, {
  eager: true,
});

// TODO: we need nice API here
function formatAsResolverEntries(imports) {
  return Object.fromEntries(
    Object.entries(imports).map(([k, v]) => [k.replace(/\.g?(j|t)s$/, '').replace(/^\.\//, 'app-template-minimal/'), v])
  );
}

const resolverRegistry = {
  ...formatAsResolverEntries(import.meta.glob('./templates/**/*.{gjs,gts,js,ts}', { eager: true })),
  ...formatAsResolverEntries(import.meta.glob('./services/**/*.{js,ts}', { eager: true })),
  ...formatAsResolverEntries(import.meta.glob('./routes/**/*.{js,ts}', { eager: true })),
  'app-template-minimal/router': Router,
};

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules(resolverRegistry);
}
