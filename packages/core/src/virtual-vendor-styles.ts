import { type Package } from '@embroider/shared-internals';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export function decodeVirtualVendorStyles(filename: string): boolean {
  return filename.endsWith('-embroider-vendor-styles.css');
}

export function renderVendorStyles(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getVendorStyles(owner, resolver), watches: [] };
}

function getVendorStyles(owner: Package, resolver: Resolver): string {
  console.log(owner);
  console.log(resolver);
  return `
h1 {
  font-weight: 800;
}
  `;
}
