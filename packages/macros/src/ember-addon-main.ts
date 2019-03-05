import { join } from 'path';
import { MacrosConfig } from '.';

export = {
  name: '@embroider/macros',

  included(this: any, parent: any) {
    this._super.included.apply(this, arguments);
    let parentOptions = (parent.options = parent.options || {});
    let ownOptions = (parentOptions['@embroider/macros'] =
      parentOptions['@embroider/macros'] || {});

    // if parent is an addon it has root. If it's an app it has project.root.
    let source = parent.root || parent.project.root;

    if (ownOptions.setOwnConfig) {
      MacrosConfig.shared().setOwnConfig(source, ownOptions.setOwnConfig);
    }

    if (ownOptions.setConfig) {
      for (let [packageName, config] of Object.entries(ownOptions.setConfig)) {
        MacrosConfig.shared().setConfig(source, packageName, config);
      }
    }

    let babelOptions = (parentOptions.babel = parentOptions.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);
    babelPlugins.unshift(MacrosConfig.shared().babelPluginConfig(source));
  },

  setupPreprocessorRegistry(type: "parent" | "self", registry: any) {
    if (type === 'parent') {

      // the htmlbars-ast-plugins are split into two parts because order is
      // important. Weirdly, they appear to run in the reverse order that you
      // register them here.

      let plugins = MacrosConfig.shared().astPlugins((this as any).parent.root);
      plugins.reverse().forEach((plugin, index) => {
        registry.add('htmlbars-ast-plugin', {
          name: `@embroider/macros/${index}`,
          plugin,
          baseDir() {
            return join(__dirname, '..');
          }
        });
      });
    }
  }
};
