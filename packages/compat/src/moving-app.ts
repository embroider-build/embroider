import { Package, PackageCache }  from '@embroider/core';

export default class MovingApp extends Package {
  constructor(
    private moved: PackageCache,
    readonly destRoot: string,
    private originalPackage: Package,
  ) {
    super();
  }

  get root() {
    return this.originalPackage.root;
  }

  get name(): string {
    return this.originalPackage.name;
  }

  get packageJSON(): any {
    return this.originalPackage.packageJSON;
  }

  get dependencies(): Package[] {
    return this.originalPackage.dependencies.map(dep => this.moved.resolve(dep.name, this));
  }
}
