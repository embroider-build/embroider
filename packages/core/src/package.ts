export default interface Package {
  readonly root: string;
  readonly name: string;
  readonly packageJSON: any;
  readonly dependencies: Package[];
  readonly descendants: Package[];
  readonly dependedUponBy: Set<Package>;
  findDescendants(filter?: (pkg: Package) => boolean): Package[];
}
