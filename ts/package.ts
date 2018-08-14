export default interface Package {
  isEmberPackage: boolean;
  dependencies: Package[];
  root: string;
}
