import { join } from 'path';
import { MacrosConfig, isEmbroiderMacrosPlugin } from './node';

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
        MacrosConfig.for(appInstance).setConfig(source, packageName, config as object);
      }
    }

    if (appInstance.env !== 'production') {
      let macros = MacrosConfig.for(appInstance);
      // tell the macros where our app is
      macros.enableAppDevelopment(join(appInstance.project.configPath(), '..', '..'));
      // also tell them our root project is under development. This can be
      // different, in the case where this is an addon and the app is the dummy
      // app.
      macros.enablePackageDevelopment(appInstance.project.root);
      // keep the macros in runtime mode for development & testing
      macros.enableRuntimeMode();
    }

    // add our babel plugin to our parent's babel
    this.installBabelPlugin(parent);

    // and to our own babel, because we may need to inline runtime config into
    // our source code
    this.installBabelPlugin(this);

    appInstance.import('vendor/embroider-macros-test-support.js', { type: 'test' });

    // When we're used inside the traditional ember-cli build pipeline without
    // Embroider, we unfortunately need to hook into here uncleanly because we
    // need to delineate the point in time after which writing macro config is
    // forbidden and consuming it becomes allowed. There's no existing hook with
    // that timing.
    const originalToTree = appInstance.toTree;
    appInstance.toTree = function () {
      MacrosConfig.for(appInstance).finalize();
      return originalToTree.apply(appInstance, arguments);
    };
  },

  // Other addons are allowed to call this. It's needed if an addon needs to
  // emit code containing macros into that addon's parent (via a babel plugin,
  // for exmple). This is only an issue in classic builds, under embroider all
  // babel plugins should be thought of as *language extensions* that are
  // available everywhere, we don't scope them so narrowly so this probably
  // doesn't come up.
  installBabelPlugin(this: any, appOrAddonInstance: any) {
    let babelOptions = (appOrAddonInstance.options.babel = appOrAddonInstance.options.babel || {});
    let babelPlugins = (babelOptions.plugins = babelOptions.plugins || []);
    if (!babelPlugins.some(isEmbroiderMacrosPlugin)) {
      let appInstance = this._findHost();
      let source = appOrAddonInstance.root || appOrAddonInstance.project.root;
      babelPlugins.unshift(MacrosConfig.for(appInstance).babelPluginConfig(source));
    }
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
      let { plugins, setConfig, getConfigForPlugin } = MacrosConfig.astPlugins((this as any).parent.root);
      this.setMacrosConfig = setConfig;
      plugins.forEach((plugin, index) => {
        let name = `@embroider/macros/${index}`;
        let baseDir = join(__dirname, '..');
        let projectRoot = (this as any).parent.root;

        registry.add('htmlbars-ast-plugin', {
          name,
          plugin,
          parallelBabel: {
            requireFile: join(__dirname, 'glimmer', 'ast-transform.js'),
            buildUsing: 'buildPlugin',
            params: {
              name,
              get configs() {
                return getConfigForPlugin();
              },
              methodName: index === 0 ? 'makeSecondTransform' : 'makeFirstTransform',
              projectRoot: projectRoot,
              baseDir,
            },
          },
          baseDir: () => baseDir,
        });
      });
    }
  },

  options: {},
};
