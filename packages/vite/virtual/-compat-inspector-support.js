// Script to load the modules requied by Ember Inspector when the extension is turned on.
if (!globalThis.emberInspectorApps) {
  globalThis.emberInspectorApps = [];
}

globalThis.emberInspectorApps.push({
  name: `app-${globalThis.emberInspectorApps.length}`,
  loadCompatInspector: async () => {
    let modules = await import('@embroider/virtual/compat-inspector-modules');
    return modules;
  },
});
window.dispatchEvent(new Event('Ember'));
