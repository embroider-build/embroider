import { Tree } from "broccoli-plugin";

export default interface App {
  readonly tree: Tree;
  readonly root: string;
}
