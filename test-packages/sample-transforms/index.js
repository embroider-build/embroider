'use strict';

module.exports = {
  name: require('./package').name,

  included(parent) {
    this._super.included.apply(this, arguments);
    let parentOptions = (parent.options = parent.options || {});
    let babelOptions = (parentOptions.babel = parentOptions.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);
    babelPlugins.unshift(require.resolve('./lib/babel-plugin.js'));
  },

  setupPreprocessorRegistry(type, registry) {
    if (type === 'parent') {
      registry.add('htmlbars-ast-plugin', this._plugin());
    }
  },

  _plugin() {
    return {
      name: `embroider-sample-transforms`,
      plugin: require('./lib/glimmer-plugin'),
      baseDir() {
        return __dirname;
      },
      parallelBabel: {
        requireFile: __filename,
        buildUsing: '_plugin',
      },
    };
  },
};
