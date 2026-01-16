import type { Plugin } from 'rolldown';
import emberExternals from './src/dependencies-plugin.js';
import gjsPlugin from './src/gjs-plugin.js';

export function ember(): Plugin[] {
  return [
    emberExternals(),
    gjsPlugin()
  ]
}
