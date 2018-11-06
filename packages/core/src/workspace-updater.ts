import Plugin, { Tree } from "broccoli-plugin";
import Workspace from "./workspace";

// Copies the contents of the inputTrees into our Workspace (which is not a
// normal broccoli tree, see workspace.ts).
export default class WorkspaceUpdater extends Plugin {
  constructor(inputTrees: Tree[], private workspace: Workspace) {
    super([...inputTrees, workspace], {});
  }

  build() {
    this.workspace.clearApp();
    for (let srcPath of this.inputPaths) {
      this.workspace.copyIntoApp(srcPath);
    }
  }
}
