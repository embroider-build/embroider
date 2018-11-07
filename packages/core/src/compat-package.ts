import Addon from "./addon";

export default interface CompatPackage {
  originalRoot: string;
  npmDependencies: Addon[];
  root: string;
  activeDescendants: Addon[];
  originalPackageJSON: any;
}
