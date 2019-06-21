import { NodePath, Node } from '@babel/traverse';

export default interface State {
  removed: NodePath[];
  pendingTasks: (() => void)[];
  generatedRequires: Set<Node>;
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
  };
}

export function sourceFile(path: NodePath, state: State): string {
  return state.opts.owningPackageRoot || path.hub.file.opts.filename;
}
