import { Configuration } from 'webpack';

// [babel-loader](https://webpack.js.org/loaders/babel-loader/#options) specific options.
// This does not include the babel configuration, which is pulled from the app, only the
// additional options that `babel-loader` supports.
export interface BabelLoaderOptions {
  cacheDirectory?: boolean | string;
  cacheIdentifier?: string;
  cacheCompression?: boolean;
  customize?: string;
}

export interface Options {
  webpackConfig: Configuration;

  // the base public URL for your assets in production. Use this when you want
  // to serve all your assets from a different origin (like a CDN) than your
  // actual index.html will be served on.
  //
  // This should be a URL ending in "/".
  publicAssetURL?: string;

  // in early versions of @embroider/webpack the `publicAssetURL` option was
  // defined incorrectly and made the assumption that it should prepend
  // `assets/` to all asset URL paths. Setting this option disables this
  // automatic path modification which means that the `publicAssetURL` option
  // correctly defines the location where the the `assets` directory is being
  // served as opposed to where the whole app dist is served (which previously
  // needed to contain an `assets/` subdirectory)
  usesCorrectAssetURL?: boolean;

  // [thread-loader](https://github.com/webpack-contrib/thread-loader) options.
  // If set to false, `thread-loader` will not be used. If set to an object, it
  // will be used to configure `thread-loader`. If not specified,
  // `thread-loader` will be used with a default configuration.
  //
  // Note that setting `JOBS=1` in the environment will also disable
  // `thread-loader`.
  threadLoaderOptions?: object | false;

  babelLoaderOptions?: BabelLoaderOptions;

  /**
   * Options for [`css-loader`](https://webpack.js.org/loaders/css-loader)
   */
  cssLoaderOptions?: object;

  /**
   * Options for [`style-loader`](https://webpack.js.org/loaders/style-loader/).
   *
   * Note that [`mini-css-extract-plugin`](https://webpack.js.org/plugins/mini-css-extract-plugin/)
   * is used instead of `style-loader` in production builds.
   */
  styleLoaderOptions?: object;
}
