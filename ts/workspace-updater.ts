import Plugin from "broccoli-plugin";
import Workspace from "./workspace";

// Copies the contents of the inputTrees into our Workspace (which is not a
// normal broccoli tree, see workspace.ts).
export default class WorkspaceUpdater extends Plugin {
  constructor(inputTrees, private workspace: Workspace) {
    super([...inputTrees, workspace], {});
  }

  build() {
    for (let srcPath of this.inputPaths) {
      this.workspace.copyIntoApp(srcPath);
    }
  }
}
