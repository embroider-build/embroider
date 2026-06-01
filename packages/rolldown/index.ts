import type { Plugin } from 'rolldown';
import { emberExternals } from './src/externals.js';
import { emberTransform } from './src/transform.js';

export function ember(): Plugin[] {
  return [emberExternals(), emberTransform()];
}
