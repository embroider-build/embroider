import { NodePath, Node } from '@babel/traverse';
import cloneDeepWith from 'lodash/cloneDeepWith';
import lodashCloneDeep from 'lodash/cloneDeep';
import { join, dirname, resolve } from 'path';
import { explicitRelative, Package, PackageCache } from '@embroider/core';

export default interface State {
  generatedRequires: Set<Node>;
  removed: Set<Node>;
  calledIdentifiers: Set<Node>;
  jobs: (() => void)[];

  // map from local name to imported name
  neededRuntimeImports: Map<string, string>;

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

    // the package root directory of the app, if the app is under active
    // development. Needed so that we can get consistent answers to
    // `isDevelopingApp` and `isDeveopingThisPackage`
    appPackageRoot: string | undefined;

    embroiderMacrosConfigMarker: true;

    mode: 'compile-time' | 'run-time';
  };
}

const runtimePath = resolve(join(__dirname, '..', 'addon', 'runtime'));

export function pathToRuntime(path: NodePath, state: State): string {
  if (!state.opts.owningPackageRoot) {
    // running inside embroider, so make a relative path to the module
    let source = sourceFile(path, state);
    return explicitRelative(dirname(source), runtimePath);
  } else {
    // running inside a classic build, so use a classic-compatible runtime
    // specifier
    return '@embroider/macros/runtime';
  }
}

export function sourceFile(path: NodePath, state: State): string {
  return state.opts.owningPackageRoot || path.hub.file.opts.filename;
}

const packageCache = PackageCache.shared('embroider-stage3');

export function owningPackage(path: NodePath, state: State): Package {
  let file = sourceFile(path, state);
  let pkg = packageCache.ownerOfFile(file);
  if (!pkg) {
    throw new Error(`unable to determine which npm package owns the file ${file}`);
  }
  return pkg;
}

export function cloneDeep(node: Node, state: State): Node {
  return cloneDeepWith(node, function(value: any) {
    if (state.generatedRequires.has(value)) {
      let cloned = lodashCloneDeep(value);
      state.generatedRequires.add(cloned);
      return cloned;
    }
  });
}

export function unusedNameLike(name: string, path: NodePath<unknown>) {
  let candidate = name;
  let counter = 0;
  while (path.scope.getBinding(candidate)) {
    candidate = `${name}${counter++}`;
  }
  return candidate;
}
