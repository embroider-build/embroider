// this is the public entrypoint for Node-side code, as opposed to index.ts
// which is our browser-visible public entrypoint

// Entrypoint for managing the macro config within Node.
export { default as MacrosConfig, Merger } from './macros-config';

// Utility for detecting our babel and AST plugins.
import { PluginItem } from '@babel/core';
export function isEmbroiderMacrosPlugin(item: PluginItem) {
  return (
    (Array.isArray(item) &&
      item.length > 1 &&
      item[1] &&
      typeof item[1] === 'object' &&
      (item[1] as any).embroiderMacrosConfigMarker) ||
    (item && typeof item === 'function' && (item as any).embroiderMacrosASTMarker)
  );
}
