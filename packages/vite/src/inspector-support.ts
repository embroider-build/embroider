import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'path';

import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Includes a file that provides Ember Inspector support for Vite.
// Ultimately, this content should be provided directly by ember-source,
// so this plugin should only be used in apps with
// ember-source <= [the version of ember-source that will include it]
export function inspectorSupport(): Plugin {
  return {
    name: 'ember-inspector-support',

    async resolveId(source) {
      if (source === '@embroider/virtual/compat-inspector-support') {
        return '-compat-inspector-support.js';
      }
      let inspectorModulesId = '@embroider/virtual/compat-inspector-modules-';
      if (source.includes(inspectorModulesId)) {
        const versionIdentifier = source.substring(inspectorModulesId.length, source.length);
        return `-compat-inspector-modules-${versionIdentifier}.js`;
      }
    },

    async load(id) {
      if (id === '-compat-inspector-support.js') {
        return readFileSync(join(__dirname, '../../virtual/-compat-inspector-support.js'), 'utf8');
      }
      if (id.includes('compat-inspector-modules-')) {
        return readFileSync(join(__dirname, `../../virtual/${id}`), 'utf8');
      }
    },
  };
}
