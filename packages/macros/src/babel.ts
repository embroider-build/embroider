import MacrosConfig from './macros-config';

export interface Options {
  /**
   * How you configure your own package / app
   */
  setOwnConfig?: object;
  /**
   * This is how you can optionally send configuration into
   * your dependencies, if those dependencies choose to use
   * @embroider/macros configs.
   *
   * @example
   * ```js
   * setConfig: {
   *   'some-dependency': {
   *      // config for some-dependency
   *   }
   * }
   * ```
   */
  setConfig?: Record<string, object>;

  /**
   * Callback for further manipulation of the macros' configuration instance.
   *
   * Useful for libraries to provide their own config with defaults shared between sub-dependencies of those libraries.
   */
  configure?: (macrosInstance: MacrosConfig) => void;
}

export function buildMacros(options: Options = {}) {
  let root = process.cwd();
  let macros = MacrosConfig.for({}, root);

  let transforms = MacrosConfig.transforms();

  transforms.setConfig(macros);

  let { setOwnConfig, setConfig, configure } = options;

  if (setOwnConfig) {
    macros.setOwnConfig(root, setOwnConfig);
  }

  if (setConfig) {
    for (let [packageName, config] of Object.entries(setConfig)) {
      macros.setConfig(root, packageName, config as object);
    }
  }

  configure?.(macros);

  if (process.env.NODE_ENV === 'development') {
    macros.enablePackageDevelopment(process.cwd());
    macros.enableRuntimeMode();
  }

  macros.finalize();

  return {
    babelMacros: macros.babelPluginConfig(),
    templateMacros: transforms.plugins,
  };
}
