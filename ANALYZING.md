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
