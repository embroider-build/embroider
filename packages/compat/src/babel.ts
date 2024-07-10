import { locateEmbroiderWorkingDir } from '@embroider/core';
import { existsSync, readJSONSync } from 'fs-extra';
import { join } from 'path';

export function loadLegacyPlugins() {
  const path = join(locateEmbroiderWorkingDir(process.cwd()), '_babel_config_.json');
  if (!existsSync(path)) {
    throw new Error(`Could not load the Babel plugins required by classic addons from ${path}`);
  }

  const { plugins } = readJSONSync(path);
  _warnIfNoLegacyPlugins(plugins);
  return plugins ?? [];
}

export function loadPluginDebugMacros() {
  return [
    [
      'babel-plugin-debug-macros',
      {
        flags: [
          {
            source: '@glimmer/env',
            flags: {
              DEBUG: true,
              CI: false,
            },
          },
        ],
        debugTools: {
          isDebug: true,
          source: '@ember/debug',
          assertPredicateIndex: 1,
        },
        externalizeHelpers: {
          module: '@ember/debug',
        },
      },
      '@ember/debug stripping',
    ],
    [
      'babel-plugin-debug-macros',
      {
        externalizeHelpers: {
          module: '@ember/application/deprecations',
        },
        debugTools: {
          isDebug: true,
          source: '@ember/application/deprecations',
          assertPredicateIndex: 1,
        },
      },
      '@ember/application/deprecations stripping',
    ],
  ];
}

function _warnIfNoLegacyPlugins(legacyPlugins: any) {
  if (!legacyPlugins || !legacyPlugins.length) {
    console.warn(`
      Your Ember app doesn't use any classic addon that requires Babel plugins.
      In your babel.config.cjs, you can safely remove the usage of loadLegacyPlugins.

      Remove:
      - const { loadLegacyPlugins } = require('@embroider/compat');
      - ...loadLegacyPlugins(),

      If you install a classic addon in your app afterward, make sure to add any Babel config it may require to babel.config.cjs.
    `);
  }
}
