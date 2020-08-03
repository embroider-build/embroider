import { join } from 'path';
import { MacrosConfig } from '.';

export = {
  name: '@embroider/macros',
  included(this: any, parent: any) {
    this._super.included.apply(this, arguments);
    this.options.babel = { plugins: [] };
    let parentOptions = (parent.options = parent.options || {});
    let ownOptions = (parentOptions['@embroider/macros'] = parentOptions['@embroider/macros'] || {});

    const appInstance = this._findHost();
    this.setMacrosConfig(MacrosConfig.for(appInstance));
    // if parent is an addon it has root. If it's an app it has project.root.
    let source = parent.root || parent.project.root;

    if (ownOptions.setOwnConfig) {
      MacrosConfig.for(appInstance).setOwnConfig(source, ownOptions.setOwnConfig);
    }

    if (ownOptions.setConfig) {
      for (let [packageName, config] of Object.entries(ownOptions.setConfig)) {
        MacrosConfig.for(appInstance).setConfig(source, packageName, config);
      }
    }

    if (appInstance.env !== 'production') {
      MacrosConfig.for(appInstance).enableAppDevelopment(appInstance.root);
      MacrosConfig.for(appInstance).enableRuntimeMode();
    }

    let babelOptions = (parentOptions.babel = parentOptions.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);

    // add our babel plugin to our parent's babel
    babelPlugins.unshift(MacrosConfig.for(appInstance).babelPluginConfig(source));

    // and to our own babel, because we may need to inline runtime config into
    // our source code
    this.options.babel.plugins.unshift(MacrosConfig.for(appInstance).babelPluginConfig(this.root));

    appInstance.import('vendor/embroider-macros-test-support.js', { type: 'test' });

    // When we're used inside the traditional ember-cli build pipeline without
    // Embroider, we unfortunately need to hook into here uncleanly because we
    // need to delineate the point in time after which writing macro config is
    // forbidden and consuming it becomes allowed. There's no existing hook with
    // that timing.
    const originalToTree = appInstance.toTree;
    appInstance.toTree = function() {
      MacrosConfig.for(appInstance).finalize();
      return originalToTree.apply(appInstance, arguments);
    };
  },

  setupPreprocessorRegistry(this: any, type: 'parent' | 'self', registry: any) {
    if (type === 'parent') {
      // the htmlbars-ast-plugins are split into two parts because order is
      // important. Weirdly, they appear to run in the reverse order that you
      // register them here.
      //
      // MacrosConfig.astPlugins is static because in classic ember-cli, at this
      // point there's not yet an appInstance, so we defer getting it and
      // calling setConfig until our included hook.
      let { plugins, setConfig } = MacrosConfig.astPlugins((this as any).parent.root);
      this.setMacrosConfig = setConfig;
      plugins.forEach((plugin, index) => {
        registry.add('htmlbars-ast-plugin', {
          name: `@embroider/macros/${index}`,
          plugin,
          baseDir() {
            return join(__dirname, '..');
          },
        });
      });
    }
  },
  options: {},
};
