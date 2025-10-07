# @embroider/legacy-inspector-support

This package provides a compat integration to allow the ember-inspector to load modules provided by ember-source. This implementation is intended to be a **legacy** feature and should be phased out as the inspector starts to consume public APIs from ember-source instead of importing modules directly.

## Installation

```
ember install @embroider/legacy-inspector-support
```

## Usage

For any app with an ember-source version >=4.12 you need to import the `setupInspector()` function from `@embroider/legacy-inspector-support/ember-source-4.12` and pass your `Application` subclass into the function.

```js
import Application from '@ember/application';
import compatModules from '@embroider/virtual/compat-modules';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

// import the setupInspector() function
import setupInspector from '@embroider/legacy-inspector-support/ember-source-4.12';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules(compatModules);
  
  // setup inspector for this application
  inspector = setupInspector(this);
}

loadInitializers(App, config.modulePrefix, compatModules);
```

If you are on `ember-source` version `4.8` you can import the same function from `@embroider/legacy-inspector-support/ember-source-4.8` and for all older versions of `ember-source` you can import from `@embroider/legacy-inspector-support/ember-source-3.28`


## Development

This package is written in JS and uses `"type": "module"` so it is ESM only. Types are being automatically built from the `@jsdoc` comments in the JS code.
