import { join } from 'path';
import { MacrosConfig } from '.';

export = {
  name: '@embroider/macros',
  included(this: any, parent: any) {
    this._super.included.apply(this, arguments);
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

    let babelOptions = (parentOptions.babel = parentOptions.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);
    babelPlugins.unshift(MacrosConfig.for(appInstance).babelPluginConfig(source));

    // Here we attach to ember-cli's default EmberApp#toTree. This allows us to
    // mimic the appropriate timing semantics of the MacrosConfig read after
    // write guarantee.
    //
    // In general, we do not condone this type of monkey patching and our plan
    // is if this indeed remains needed, to add the appropriate public API in
    // ember-cli. One interesting tid-bit, once users use embroider primarily
    // this hack will have no impact, and then adding the API to ember-cli
    // may be wasted. We will see how this plays out, and do the appropriate
    // thing.
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
};
