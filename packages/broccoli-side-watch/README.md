# @embroider/broccoli-side-watch

A micro library that allows watching folders for changes outside the `app` folder in Ember apps

## Usage

Let's assume you have a v2 addon with a package name of `grand-prix` somewhere in your monorepo that also contains your Ember app.

Every time you change something in the source of that addon, you can rebuild it by watching the addon's build (currently using rollup). However, by default the host Ember app doesn't rebuild automatically, so you have to restart the Ember app every time this happens which is a slog.

With this library, you can add the following to your `ember-cli-build.js` to vastly improve your life as a developer:

```js
const sideWatch = require('@embroider/broccoli-side-watch');

const app = new EmberApp(defaults, {  
  trees: {
    app: sideWatch('app', { watching: [
      'grand-prix', // this will resolve the package by name and watch all its importable code
      '../grand-prix/dist', // or you point to a specific directory to be watched
      ] }),
  },
});
```
