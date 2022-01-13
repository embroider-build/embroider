import type { NodePath, Node } from '@babel/traverse';
import cloneDeepWith from 'lodash/cloneDeepWith';
import lodashCloneDeep from 'lodash/cloneDeep';
import { join, dirname, resolve } from 'path';
import { explicitRelative, Package, PackageCache } from '@embroider/shared-internals';
import type { ImportUtil } from 'babel-import-util';

export default interface State {
  importUtil: ImportUtil;
  generatedRequires: Set<Node>;
  removed: Set<Node>;
  calledIdentifiers: Set<Node>;
  jobs: (() => void)[];
  packageCache: PackageCache;

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

    mode: 'compile-time' | 'run-time';

    importSyncImplementation: 'cjs' | 'eager';
  };
}

const runtimeAddonPath = resolve(join(__dirname, '..', 'addon'));

// todo: put a method on state instead?
// todo: maybe state should already know the file so we don't need to pass path too?
export function pathToAddon(moduleName: string, path: NodePath, state: State): string {
  if (!state.opts.owningPackageRoot) {
    // running inside embroider, so make a relative path to the module
    let source = sourceFile(path, state);
    return explicitRelative(dirname(source), join(runtimeAddonPath, moduleName));
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

export function sourceFile(path: NodePath, state: State): string {
  return state.opts.owningPackageRoot || path.hub.file.opts.filename;
}

export function owningPackage(path: NodePath, state: State): Package {
  let file = sourceFile(path, state);
  let pkg = state.packageCache.ownerOfFile(file);
  if (!pkg) {
    throw new Error(`unable to determine which npm package owns the file ${file}`);
  }
  return pkg;
}

export function cloneDeep(node: Node, state: State): Node {
  return cloneDeepWith(node, function (value: any) {
    if (state.generatedRequires.has(value)) {
      let cloned = lodashCloneDeep(value);
      state.generatedRequires.add(cloned);
      return cloned;
    }
  });
}
