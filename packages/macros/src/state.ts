import { NodePath } from '@babel/traverse';

export default interface State {
  removed: NodePath[];
  opts: {
    userConfigs: {
      [pkgRoot: string]: unknown
    }
  };
}

export function sourceFile(path: NodePath, _: State): string {
  return path.hub.file.opts.filename;
}
