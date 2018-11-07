import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import CompatWorkspace from './compat-workspace';
import WorkspaceUpdater from './workspace-updater';
import { Packager } from './packager';
import PackagerRunner from './packager-runner';
import { V1AddonConstructor } from './v1-addon';
import mergeTrees from 'broccoli-merge-trees';
import Workspace from './workspace';
import MovedApp from './moved-app';

class Options {
  legacyAppInstance: any;
  workspaceDir?: string;
  compatAdapters?: Map<string, V1AddonConstructor>;
  emitNewRoot?: (path: string) => void;
  extraPublicTrees?: Tree[];
}

export default class App {
  private extraPublicTrees: Tree[] | undefined;

  static create(_: string, options: Options) {
    let workspace = new CompatWorkspace(options.legacyAppInstance, {
      workspaceDir: options.workspaceDir,
      compatAdapters: options.compatAdapters
    });

    if (options && options.emitNewRoot) {
      options.emitNewRoot(workspace.appDest.root);
    }

    return new this(workspace, options);
  }

  private constructor(private workspace: Workspace, options?: Options) {
    if (options && options.extraPublicTrees) {
      this.extraPublicTrees = options.extraPublicTrees;
    }
  }

  get root(): string {
    return this.workspace.appDest.root;
  }

  // This is the end of the Vanilla build pipeline -- this is the tree you want
  // to make broccoli build, though the actual output will appear in
  // `this.outputPath` instead. See workspace.ts for explanation.
  get vanillaTree(): Tree {
    if (!(this.workspace.appDest instanceof MovedApp)) {
      throw new Error("not implemented yet");
    }
    let appDest = this.workspace.appDest;

    let { appJS, analyzer, htmlTree, publicTree } = appDest;
    let updateHTML = appDest.updateHTML.bind(appDest);

    // todo: this should also take the public trees of each addon
    if (this.extraPublicTrees) {
      publicTree = mergeTrees([publicTree, ...this.extraPublicTrees]);
    }

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(this.workspace, appJS, htmlTree, publicTree, appDest, analyzer, updateHTML);

    return new WorkspaceUpdater([publicTree, appJS, entry], this.workspace);
  }

  packageWith(packagerClass: Packager): Tree {
    return new PackagerRunner(packagerClass, this);
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}
