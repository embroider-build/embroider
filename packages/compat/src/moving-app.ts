import { Package, PackageCache, BasicPackage }  from '@embroider/core';

export default class MovingApp extends BasicPackage {
  constructor(
    moved: PackageCache,
    readonly destRoot: string,
    originalPackage: Package,
  ) {
    super(originalPackage.root, true, moved);
  }
}
