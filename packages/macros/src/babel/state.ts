import { NodePath, Node } from '@babel/traverse';
import cloneDeepWith from 'lodash/cloneDeepWith';
import lodashCloneDeep from 'lodash/cloneDeep';

export default interface State {
  generatedRequires: Set<Node>;
  removed: Set<Node>;
  calledIdentifiers: Set<Node>;
  jobs: (() => void)[];

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
