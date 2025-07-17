// Script to load the modules requied by Ember Inspector when the extension is turned on.
import { macroCondition, dependencySatisfies } from '@embroider/macros';

if (!globalThis.emberInspectorApps) {
  globalThis.emberInspectorApps = [];
}

globalThis.emberInspectorApps.push({
  name: `app-${globalThis.emberInspectorApps.length}`,
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
