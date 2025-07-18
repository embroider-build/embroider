// This script exposes the modules used by Ember Inspector so an app that
// builds with Vite can be inspected.

import { macroCondition, dependencySatisfies } from '@embroider/macros';

export default function (appName) {
  if (!globalThis.emberInspectorApps) {
    globalThis.emberInspectorApps = [];
  }

  globalThis.emberInspectorApps.push({
    name: appName ?? `app-${globalThis.emberInspectorApps.length}`,
    loadCompatInspector: async () => {
      let modules;
      // if (macroCondition(dependencySatisfies('ember-source', '<4.8.0'))) {
      if (false) {
        modules = await import('./modules-3-16');
      } else {
        modules = await import('./modules-4-8');
      }
      return modules;
    },
  });
  window.dispatchEvent(new Event('Ember'));
}
