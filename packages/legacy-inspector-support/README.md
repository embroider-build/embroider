# @embroider/legacy-inspector-support

This package provides a compat integration to allow the ember-inspector to load modules provided by ember-source to correctly function. This implementation is intended to be a **legacy** feature and should be phased out as more functionality is improved in the inspector and it starts to consume public APIs from ember-sourse to provide the same features.

## Usage

For any app with an ember-source version >=4.8 you need to import the `seteupInspector()` function from `@embroider/legacy-inspector-support/ember-source-4.8` and pass your `Application` subclass into the fucnction.

```js
import Application from '@ember/application';
import compatModules from '@embroider/virtual/compat-modules';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

// import the setupInspector() function
import setupInspector from '@embroider/legacy-inspector-support/ember-source-4.8';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules(compatModules);
  
  // setup inspector for this application
  inspector = setupInspector(this);
}

loadInitializers(App, config.modulePrefix, compatModules);
```

If you are on an older `ember-source` version you can import the same function from `@embroider/legacy-inspector-support/ember-source-3.28`.


## Development

This package is written in JS and uses `"type": "module"` so it is ESM only. Types are being automatically built from the `@jsdoc` comments in the JS code.
