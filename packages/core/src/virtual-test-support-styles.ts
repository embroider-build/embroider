import type { Package } from '@embroider/shared-internals';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export function decodeTestSupportStyles(filename: string): boolean {
  return filename.endsWith('-embroider-test-support-styles.css');
}

export function renderTestSupportStyles(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getTestSupportStyles(owner, resolver), watches: [] };
}

function getTestSupportStyles(owner: Package, resolver: Resolver): string {
  console.log(owner);
  console.log(resolver);
  return `h1 { color: white; }`;
}
