import { NodePath, Node } from '@babel/traverse';
import cloneDeepWith from 'lodash/cloneDeepWith';
import lodashCloneDeep from 'lodash/cloneDeep';
import { join, dirname } from 'path';
import { explicitRelative } from '@embroider/core';

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
    // we set this when we're running inside classic ember-cli, because in that
    // case we don't have finer-grained info available about where the files
    // we're processing are globally located. When running in embroider, we
    // don't set this, because each file is visible at its full
    // globally-relevant path.
    owningPackageRoot: string | undefined;

    embroiderMacrosConfigMarker: true;

    mode: 'compile-time' | 'run-time';
  };
}

const runtimePath = join(__dirname, 'runtime');

export function relativePathToRuntime(path: NodePath, state: State): string {
  let source = sourceFile(path, state);
  return explicitRelative(dirname(source), runtimePath);
}

export function sourceFile(path: NodePath, state: State): string {
  return state.opts.owningPackageRoot || path.hub.file.opts.filename;
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
