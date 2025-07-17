import type { Plugin } from 'vite';

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
        return `compat-inspector-modules-${versionIdentifier}.js`;
      }
    },

    async load(id) {
      if (id === '-compat-inspector-support.js') {
        return `// Script to load the modules requied by Ember Inspector when the extension is turned on.
import { macroCondition, dependencySatisfies } from '@embroider/macros';

 export default function (appName) {
  if (!globalThis.emberInspectorApps) {
    globalThis.emberInspectorApps = [];
  }

  globalThis.emberInspectorApps.push({
    name: appName ?? \`app-\${globalThis.emberInspectorApps.length}\`,
    loadCompatInspector: async () => {
      let modules;
      if (macroCondition(dependencySatisfies('ember-source', '<4.8.0'))) {
        modules = await import('@embroider/virtual/compat-inspector-modules-3-28');
      } else {
        modules = await import('@embroider/virtual/compat-inspector-modules-4-8');
      }
      return modules;
    },
  });
  window.dispatchEvent(new Event('Ember'));
}`;
      }
      if (id.includes('compat-inspector-modules-')) {
        let content = await import(`./runtime/inspector-support/${id}`);
        return `${content.default}`;
      }
    },
  };
}
