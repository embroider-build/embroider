import { Tree } from 'broccoli-plugin';

export default interface V1Package {
  // The full set of trees that represent this package rewritten into v2 format.
  v2Trees : Tree[];

  // If the package provides app Javascript, that tree is accessible here. It is
  // also necessarily in v2Trees.
  appTree: Tree | undefined;

  root: string;
  name: string;
}
