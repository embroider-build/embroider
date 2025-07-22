import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { join } from 'path';
import resolvePackagePath from 'resolve-package-path';
import semver from 'semver';

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
      if (source === '@embroider/virtual/compat-inspector-modules') {
        const emberSourcePackage = resolvePackagePath('ember-source', process.cwd());
        if (emberSourcePackage === null) {
          throw new Error(`Inspector support: cannot resolve ember-source package.json`);
        }
        const lt48 = semver.lt(JSON.parse(readFileSync(emberSourcePackage, 'utf8')).version, '4.8.0');
        const versionIdentifier = lt48 ? '3-28' : '4-8';
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
