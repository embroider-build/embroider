import Addon from "./addon";

export default interface CompatPackage {
  originalRoot: string;
  npmDependencies: Addon[];
  root: string;
  dependedUponBy: Set<CompatPackage>;
  activeDescendants: Addon[];
  originalPackageJSON: any;
}
