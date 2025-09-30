export default function setupGlobal(app, importCallback) {
  if (!globalThis.emberInspectorApps) {
    globalThis.emberInspectorApps = [];
  }

  globalThis.emberInspectorApps.push({
    app,
    name: `app-${globalThis.emberInspectorApps.length}`,
    loadCompatInspector: importCallback,
  });

  window.dispatchEvent(new Event('Ember'));
}
