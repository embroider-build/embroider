# Analyzing Bundles

You can analyze webpack's generated bundles using [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer#webpack-bundle-analyzer).

1. require `BundleAnalyzerPlugin` at the top of your `ember-cli-build.js` file:

```javascript
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
````

2. Configure webpack to use this plugin through embroider's `webpackConfig` option:

```javascript
return require('@embroider/compat').compatBuild(app, Webpack, {
    packagerOptions: {
      webpackConfig: {
        plugins: [new BundleAnalyzerPlugin()]
      }
    }
});
```

Note this step modifies the snippet as described in step 2 in the [README.md](README.md).

This will not show the contents of vendor.js, which provides legacy support for addons that import things into script context and doesn't go through webpack. To see what is contributing to the size of vendor.js, set the environment variable `EMBROIDER_CONCAT_STATS=true` like:

```
EMBROIDER_CONCAT_STATS=true ember build
```

Which will cause your build to print output like:

```
Concatenated assets/vendor.js:
  ./node_modules/@embroider/synthesized-vendor/vendor/ember/ember.debug.js: 1.76 MB
  ./node_modules/@embroider/synthesized-vendor/vendor/jquery/jquery.js: 265.38 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/hammerjs/hammer.js: 72.1 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/loader/loader.js: 8.75 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/propagating-hammerjs/propagating.js: 7.34 KB
  in-memory: 85 B
  ./node_modules/@embroider/synthesized-vendor/vendor/ember-paper/register-version.js: 57 B
Concatenated assets/test-support.js:
  ./node_modules/@embroider/synthesized-vendor/vendor/qunit/qunit.js: 148.2 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/ember/ember-testing.js: 76.44 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/qunit-dom.js: 37.67 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/monkey-patches.js: 1.32 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/ember-qunit/qunit-configuration.js: 491 B
  ./node_modules/@embroider/synthesized-vendor/vendor/overwrite-qunit-dom-root-element.js: 181 B
  ./node_modules/@embroider/synthesized-vendor/vendor/define-dummy-module.js: 54 B
Concatenated assets/test-support.css:
  ./node_modules/@embroider/synthesized-vendor/vendor/qunit/qunit.css: 7.69 KB
  ./node_modules/@embroider/synthesized-vendor/vendor/ember-qunit/test-container-styles.css: 544 B
```
