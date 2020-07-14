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

    // this uses setGlobalConfig instead of setOwnConfig because these things
    // truly are global. Even if a package doesn't have a dep or peerDep on
    // @embroider/macros, it's legit for them to want to know the answer to
    // these questions, and there is only one answer throughout the whole
    // dependency graph.
    MacrosConfig.for(appInstance).setGlobalConfig(__filename, '@embroider/macros', {
      // this powers the `isDeveloping` macro. Anything that is not production
      // is development (so under the classic conventions of ember-cli, tests
      // are also `isDeveloping() === true`. The point of `isDeveloping` is to
      // ask: should I provide the optimal experience for developers (by
      // including more assertions, for example) vs end users (by stripping away
      // nicer assertions and errors in favor of the smallest fastest possible
      // code).
      isDeveloping: appInstance.env !== 'production',

      // this powers the `isTesting` macro. It always starts out false here,
      // because:
      //  - if this is a production build, we will resolve all macros at build
      //    time and isTesting will stay false, so test-only code will not be
      //    included.
      //  - if this is a dev build, we resolve macros at runtime, which allows
      //    both "I'm running my app in development" and "I'm running my test
      //    suite" to coexist within a single build. When you run the test
      //    suite, early in the runtime boot process we can flip isTesting to
      //    true to distinguish the two.
      isTesting: false,
    });

    if (appInstance.env !== 'production') {
      MacrosConfig.for(appInstance).enableRuntimeMode();
    }

    let babelOptions = (parentOptions.babel = parentOptions.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);
    babelPlugins.unshift(MacrosConfig.for(appInstance).babelPluginConfig(source));

    appInstance.import('vendor/embroider-macros-test.js', { type: 'test' });

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
};
