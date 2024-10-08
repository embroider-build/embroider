const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlBundlerPlugin = require('html-bundler-webpack-plugin');
// const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// const { resolver, hbs, scripts, templateTag, compatPrebuild, contentFor } = require('@embroider/webpack');

module.exports = function (env, argv) {
  let isProduction = env.production;
  let isDevelopment = !isProduction;

  console.log({ isDevelopment, isProduction });

  return {
    mode: env.production ? 'production' : 'development',
    devtool: env.production ? 'source-map' : 'eval',
    devServer: {
      port: 4200,
    },
    resolve: {
      extensions: ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json', '.wasm'],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
      // hbs(),
      // // gjs
      // templateTag(),
      // scripts(),
      // resolver(),
      // compatPrebuild(),
      // contentFor(),
      new HtmlBundlerPlugin({
        // all the necessary options are in one place
        entry: {
          index: {
            import: './index.html',
          },
          tests: {
            import: './tests/index.html',
          },
        },
        js: {
          filename: 'assets/[name].[contenthash:8].js', // JS output filename
        },
        css: {
          filename: 'assets/[name].[contenthash:8].css', // CSS output filename
        },
      }),
    ],
    module: {
      rules: [
        {
          test: /\.g?(j|t)s$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                url: true,
                import: true,
                modules: 'global',
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
          type: 'asset/resource',
        },
      ],
    },
    performance: {
      hints: false,
    },
    optimization: {
      splitChunks: { chunks: 'all' },
      ...(isProduction
        ? {
            minimizer: [
              new TerserPlugin({
                parallel: true,
                terserOptions: {
                  // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
                },
              }),
            ],
          }
        : {}),
    },
  };
};
