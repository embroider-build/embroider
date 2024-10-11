const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const HtmlBundlerPlugin = require('html-bundler-webpack-plugin');

module.exports = async function (env) {
  let isProduction = env.production;
  let isDevelopment = !isProduction;

  const {
    resolver,
    // hbs,
    // scripts,
    // templateTag,
    compatPrebuild,
    // contentFor,
  } = await import('@embroider/build');

  console.log({ isDevelopment, isProduction });

  return {
    mode: env.production ? 'production' : 'development',
    devtool: env.production ? 'source-map' : 'eval',
    devServer: {
      port: 'auto',
      client: {
        progress: true,
        overlay: true,
      },
      watchFiles: {
        paths: ['app/**/*.*', 'tests/**/*.*'],
        options: {
          usePolling: true,
        },
      },
    },
    resolve: {
      extensions: ['.gjs', '.js', '.gts', '.ts', '.hbs'],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
      // hbs(),
      // // gjs
      // templateTag(),
      // scripts(),
      resolver.webpack(),
      compatPrebuild.webpack(),
      // contentFor(),
      new HtmlBundlerPlugin({
        // all the necessary options are in one place
        entry: {
          index: {
            import: path.resolve(__dirname, './index.html'),
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