import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import WorkspaceUpdater from './workspace-updater';
import mergeTrees from 'broccoli-merge-trees';
import Workspace from './workspace';
import MovingApp from './moving-app';
import App from './app';

class Options {
  extraPublicTrees?: Tree[];
}

export default class CompatApp implements App {
  private extraPublicTrees: Tree[] | undefined;

  constructor(private workspace: Workspace, options?: Options) {
    if (options && options.extraPublicTrees) {
      this.extraPublicTrees = options.extraPublicTrees;
    }
  }

  get root(): string {
    return this.workspace.appDestDir;
  }

  get tree(): Tree {
    let app = this.workspace.app;
    if (!(app instanceof MovingApp)) {
      throw new Error("Unimplemented");
    }
    let { appJS, analyzer, htmlTree, publicTree } = app;
    let updateHTML = app.updateHTML.bind(app);

    // todo: this should also take the public trees of each addon
    if (this.extraPublicTrees) {
      publicTree = mergeTrees([publicTree, ...this.extraPublicTrees]);
    }

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(this.workspace, appJS, htmlTree, publicTree, analyzer, updateHTML);

    return new WorkspaceUpdater([publicTree, appJS, entry], this.workspace);
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}
