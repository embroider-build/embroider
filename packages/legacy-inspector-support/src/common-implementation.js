export default function setupGlobal(app, importCallback) {
  if (!globalThis.emberInspectorApps) {
    globalThis.emberInspectorApps = [];
  }

  globalThis.emberInspectorApps.push({
    app,
    name: `app-${globalThis.emberInspectorApps.length}`,
    loadCompatInspector: importCallback,
  });

  // Only dispatch an event if window.dispatchEvent is available i.e. we are not in SSR mode
  if (globalThis.dispatchEvent) {
    globalThis.dispatchEvent(new Event('Ember'));
  }
}
