import { type Package } from '@embroider/shared-internals';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export function decodeImplicitTestScripts(filename: string): boolean {
  return filename.endsWith('-embroider-test-support.js');
}

export function renderImplicitTestScripts(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getTestSupport(owner, resolver), watches: [] };
}

function getTestSupport(owner: Package, resolver: Resolver): string {
  console.log(owner);
  console.log(resolver);
  return `
var runningTests=true;
if (typeof Testem !== 'undefined' && (typeof QUnit !== 'undefined' || typeof Mocha !== 'undefined')) {
  Testem.hookIntoTestFramework();
}`;
}
