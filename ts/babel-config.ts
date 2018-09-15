import { todo } from './messages';
import semver from 'semver';
import { join } from 'path';

export function updateBabelConfig(packageName, packageOptions, emberCLIBabelInstance) {
  let version;
  if (emberCLIBabelInstance) {
    version = require(join(emberCLIBabelInstance.root, 'package')).version;
  }

  if (version && semver.satisfies(version, '^5')) {
    todo(`${packageName} is using babel 5.`);
    return;
  }

  Object.assign(packageOptions['ember-cli-babel'], {
    compileModules: false,
    disablePresetEnv: true,
    disableDebugTooling: true,
    disableEmberModulesAPIPolyfill: true
  });
  if (!packageOptions.babel.plugins) {
    packageOptions.babel.plugins = [];
  }
  packageOptions.babel.plugins.push([require.resolve('./babel-plugin'), { ownName: packageName } ]);
}
