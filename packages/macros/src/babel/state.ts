import type { NodePath, Node } from '@babel/traverse';
import { join, dirname, resolve } from 'path';
import type { Package } from '@embroider/shared-internals';
import { cleanUrl, explicitRelative, RewrittenPackageCache } from '@embroider/shared-internals';
import { ImportUtil } from 'babel-import-util';
import type * as Babel from '@babel/core';

export default interface State {
  importUtil: ImportUtil;
  removed: Set<Node>;
  calledIdentifiers: Set<Node>;
  jobs: (() => void)[];
  packageCache: RewrittenPackageCache;
  sourceFile: string;
  pathToOurAddon(moduleName: string): string;
  owningPackage(): Package;
  originalOwningPackage(): Package;

  opts: {
    userConfigs: {
      [pkgRoot: string]: unknown;
    };
    globalConfig: {
      [key: string]: unknown;
    };
    // we set this when we're running inside classic ember-cli, because in that
    // case we don't have finer-grained info available about where the files
    // we're processing are globally located. When running in embroider, we
    // don't set this, because each file is visible at its full
    // globally-relevant path.
    owningPackageRoot: string | undefined;

    // list of packages that are under active development, represented by the
    // path to their package root directory
    isDevelopingPackageRoots: string[];

    // the package root directory of the app. Needed so that we can get
    // consistent answers to `isDevelopingApp` and `isDeveopingThisPackage`, as
    // well as consistent handling of Package devDependencies vs dependencies.
    appPackageRoot: string;

    embroiderMacrosConfigMarker: true;

    hideRequires: boolean;

    mode: 'compile-time' | 'run-time';
  };
}

export function initState(t: typeof Babel, path: NodePath<Babel.types.Program>, state: State) {
  state.importUtil = new ImportUtil(t, path);
  state.jobs = [];
  state.removed = new Set();
  state.calledIdentifiers = new Set();
  state.packageCache = RewrittenPackageCache.shared('embroider', state.opts.appPackageRoot);
  state.sourceFile = state.opts.owningPackageRoot || cleanUrl((path.hub as any).file.opts.filename);
  state.pathToOurAddon = pathToAddon;
  state.owningPackage = owningPackage;
  state.originalOwningPackage = originalOwningPackage;
}

const runtimeAddonPath = resolve(join(__dirname, '..', 'addon'));

function pathToAddon(this: State, moduleName: string): string {
  if (!this.opts.owningPackageRoot) {
    // running inside embroider, so make a relative path to the module
    return explicitRelative(dirname(this.sourceFile), join(runtimeAddonPath, moduleName));
  } else {
    // running inside a classic build, so use a classic-compatible runtime
    // specifier.
    //
    // CAUTION: the module we're pointing at here gets merged between all
    // present versions of @embroider/macros, and one will win. So if you are
    // introducing incompatible changes to its API, you need to change this name
    // (by tacking on a version number, etc) and rename the corresponding file
    // in ../addon.
    return `@embroider/macros/${moduleName}`;
  }
}

function owningPackage(this: State): Package {
  let pkg = this.packageCache.ownerOfFile(this.sourceFile);
  if (!pkg) {
    throw new Error(`unable to determine which npm package owns the file ${this.sourceFile}`);
  }
  return pkg;
}

function originalOwningPackage(this: State): Package {
  let pkg = this.owningPackage();
  return this.packageCache.original(pkg);
}
