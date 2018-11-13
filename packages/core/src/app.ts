import { Tree } from "broccoli-plugin";

export default interface App {
  // this is the broccoli tree that must get built for the app to be ready. But!
  // This tree's output path is _not_ necessarily where the final app will be,
  // for that you must look at `root`.
  readonly tree: Tree;

  // This is the actual directory in which the app will be.
  readonly root: string;
}
