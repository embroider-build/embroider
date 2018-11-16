import Plugin, { Tree } from "broccoli-plugin";
import Workspace from "./workspace";
import {
  readdirSync,
  removeSync,
  copySync,
} from 'fs-extra';
import { join } from 'path';

// Copies the contents of the inputTrees into our Workspace (which is not a
// normal broccoli tree, see workspace.ts).
export default class WorkspaceUpdater extends Plugin {
  constructor(inputTrees: Tree[], private workspace: Workspace) {
    super([...inputTrees, workspace], {});
  }

  build() {
    this.clearApp();
    // this is slicing off the Workspace's own tree. It's in our inputPaths
    // because it needs to be ready before we go, but we don't read from it, we
    // write into it.
    for (let srcPath of this.inputPaths.slice(0, -1)) {
      this.copyIntoApp(srcPath);
    }
  }

  clearApp(){
    for (let name of readdirSync(this.workspace.appDestDir)) {
      if (name !== 'node_modules') {
        removeSync(join(this.workspace.appDestDir, name));
      }
    }
  }

  copyIntoApp(srcPath: string) {
    copySync(srcPath, this.workspace.appDestDir, { dereference: true });
  }
}
