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
  // Because `emberWebpack()` is a plugin you add to your own
  // webpack.config.js, you extend the webpack config simply by editing that
  // file directly (add rules/plugins/resolve there as usual). The options
  // here are the embroider-specific knobs.

  // the base public URL for your assets in production. Use this when you want
  // to serve all your assets from a different origin (like a CDN) than your
  // actual index.html will be served on.
  //
  // This should be a URL ending in "/".
  //
  // For example:
  //
  // 1. If your build produces the file "./dist/assets/chunk.123.js"
  // 2. And you set publicAssetURL to "https://cdn/"
  // 3. Browsers will try to locate the file at
  //    "https://cdn/assets/chunk.123.js".
  publicAssetURL?: string;

  babelLoaderOptions?: BabelLoaderOptions;

  /**
   * Options for [`css-loader`](https://webpack.js.org/loaders/css-loader)
   */
  cssLoaderOptions?: object;

  /**
   * Options for [`mini-css-extract-plugin`](https://webpack.js.org/plugins/mini-css-extract-plugin/)
   */
  cssPluginOptions?: object;

  /**
   * Options for [`style-loader`](https://webpack.js.org/loaders/style-loader/).
   *
   * Note that [`mini-css-extract-plugin`](https://webpack.js.org/plugins/mini-css-extract-plugin/)
   * is used instead of `style-loader` in production builds.
   */
  styleLoaderOptions?: object;
}
