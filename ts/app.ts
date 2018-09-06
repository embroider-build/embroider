import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import Package from './package';
import V1App from './v1-app';
import PackageCache from './package-cache';
import { TrackedImport } from './tracked-imports';
import Workspace from './workspace';
import WorkspaceUpdater from './workspace-updater';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { Packager } from './packager';
import PackagerRunner from './packager-runner';
import { V1AddonConstructor } from './v1-addon';

class Options {
  legacyAppInstance?: any;
  workspaceDir?: string;
  compatAdapters?: Map<string, V1AddonConstructor>;
  emitNewRoot?: (path: string) => void;
}

export default class App extends Package {
  private oldPackage: V1App;
  protected packageCache: PackageCache;
  private workspaceDir: string;

  constructor(public originalRoot: string, options?: Options) {
    super(originalRoot, options ? options.emitNewRoot: null);

    let v1Cache: V1InstanceCache | undefined;
    if (options && options.legacyAppInstance) {
      v1Cache = new V1InstanceCache(options.legacyAppInstance);
      this.oldPackage = v1Cache.app;
      if (options.compatAdapters) {
        for (let [packageName, adapter] of options.compatAdapters) {
          v1Cache.registerCompatAdapter(packageName, adapter);
        }
      }
    } else {
      throw new Error("Constructing a vanilla app without a legacyAppInstance is not yet implemented");
    }

    this.packageCache = new PackageCache(v1Cache);

    if (options && options.workspaceDir) {
      this.workspaceDir = options.workspaceDir;
    } else {
      this.workspaceDir = mkdtempSync(join(tmpdir(), 'ember-cli-vanilla-'));
    }
  }

  get name(): string {
    return this.oldPackage.name;
  }

  get implicitImports(): TrackedImport[] {
    return this.oldPackage.trackedImports;
  }

  // This is the end of the Vanilla build pipeline -- this is the tree you want
  // to make broccoli build, though the actual output will appear in
  // `this.outputPath` instead. See workspace.ts for explanation.
  get vanillaTree(): Tree {
    let workspace = new Workspace(this, this.workspaceDir);

    // We need to smoosh all the app trees together. This is unavoidable until
    // everybody goes MU.
    let appJSFromAddons = this.activeDescendants.map(d => d.legacyAppTree).filter(Boolean);
    let { appJS, analyzer } = this.oldPackage.processAppJS(appJSFromAddons, this.originalPackageJSON);

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(workspace, appJS, this, analyzer);

    return new WorkspaceUpdater([appJS, entry], workspace);
  }

  packageWith(packagerClass: Packager): Tree {
    return new PackagerRunner(packagerClass, this);
  }

  get appJSPath() {
    return this.oldPackage.appJSPath;
  }

  protected dependencyKeys = ['dependencies', 'devDependencies'];

  get dependedUponBy() {
    return new Set();
  }
}
