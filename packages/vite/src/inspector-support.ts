import type { Plugin } from 'vite';
import { macroCondition, dependencySatisfies } from '@embroider/macros';

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
      if (source === '@embroider/virtual/compat-inspector-ember-imports') {
        return '-compat-inspector-ember-imports.js';
      }
    },

    async load(id) {
      if (id === '-compat-inspector-ember-imports.js') {
        let virtualExports;
        if (dependencySatisfies('ember-source', '<4.8.0')) {
          // replace with readfilesync
          virtualExports = await import('./runtime/inspector-support/compat-3-16.js');
        } else {
          virtualExports = await import('./runtime/inspector-support/compat-4-8.js');
        }
        return virtualExports;
      }
      if (id === '-compat-inspector-support.js') {
        return `// This script exposes the modules used by Ember Inspector so an app that
// builds with Vite can be inspected.

import { macroCondition, dependencySatisfies } from '@embroider/macros';
import { TrackedMap } from 'tracked-built-ins';

export default function(appName) {
  if(!globalThis.emberInspectorApps) {
    globalThis.emberInspectorApps = new TrackedMap();
  }

  globalThis.emberInspectorApps.set(appName, {
    name: appName,
    loadCompatInspector: async () => {
      let modules = await import('@embroider/virtual/compat-inspector-ember-imports');
    },
  });
  window.dispatchEvent(new Event('Ember'));
}`;
      }
    },
  };
}
