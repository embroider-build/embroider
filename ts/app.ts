import Funnel from 'broccoli-funnel';
import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import mergeTrees from 'broccoli-merge-trees';
import Package from './package';
import V1App from './v1-app';
import PackageCache from './package-cache';
import { TrackedImport } from './tracked-imports';
import DependencyAnalyzer from './dependency-analyzer';
import ImportParser from './import-parser';

export default class App extends Package {
  private oldPackage: V1App;
  protected packageCache: PackageCache;

  constructor(public root: string, v1Cache: V1InstanceCache ) {
    super(root);
    this.packageCache = new PackageCache(v1Cache);
    this.oldPackage = v1Cache.app;
  }

  get name(): string {
    return this.oldPackage.name;
  }

  get implicitImports(): TrackedImport[] {
    return this.oldPackage.trackedImports;
  }

  // This is the end of the Vanilla build pipeline -- this is the tree that we
  // can hand off to an arbitrary Javascript packager.
  get vanillaTree(): Tree {
    // We need to smoosh all the app trees together. This is unavoidable until
    // everybody goes MU.
    let appJSFromAddons = this.activeDescendants.map(d => d.legacyAppTree).filter(Boolean);
    let appJS = this.oldPackage.processAppJS(appJSFromAddons);
    return appJS;
    let importParser = new ImportParser(appJS);
    let depAnalyzer = new DependencyAnalyzer([importParser], this.packageJSON, true );

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(appJS, {
      package: this,
      outputPath: this.oldPackage.appJSPath
    });

    return mergeTrees([
      appJS,
      entry
    ]);
  }

  protected dependencyKeys = ['dependencies', 'devDependencies'];

  // TODO: This is a placeholder for development purposes only.
  dumpTrees() {
    let pkgs : Set<Package> = new Set();
    let queue : Package[] = [this];
    while (queue.length > 0) {
      let pkg = queue.shift();
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        pkg.dependencies.forEach(d => queue.push(d));
      }
    }
    return [...pkgs.values()].map((pkg, index) => new Funnel(pkg.vanillaTree, { destDir: `out-${index}` }));
  }

}
