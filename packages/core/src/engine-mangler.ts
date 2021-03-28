import { Package } from '@embroider/shared-internals';

export function mangledEngineRoot(pkg: Package) {
  return `${pkg.root}__engine_internal__`;
}
