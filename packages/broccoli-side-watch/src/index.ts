import { dirname, join, resolve } from 'path';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import { getWatchedDirectories, packageName } from '@embroider/shared-internals';
import resolvePackagePath from 'resolve-package-path';
import Plugin from 'broccoli-plugin';

import type { InputNode } from 'broccoli-node-api';

class BroccoliNoOp extends Plugin {
  constructor(path: string) {
    super([new WatchedDir(path)]);
  }
  build() {}
}

interface SideWatchOptions {
  watching?: string[];
  cwd?: string;
}

/*
  Doesn't change your actualTree, but causes a rebuild when any of opts.watching
  trees change.

  This is helpful when your build pipeline doesn't naturally watch some
  dependencies that you're actively developing. For example, right now
  @embroider/webpack doesn't rebuild itself when non-ember libraries change.
*/
function sideWatch(actualTree: InputNode, opts: SideWatchOptions = {}) {
  const cwd = opts.cwd ?? process.cwd();

  if (!opts.watching || !Array.isArray(opts.watching)) {
    console.warn(
      'broccoli-side-watch expects a `watching` array. Returning the original tree without watching any additional trees.'
    );
    return actualTree;
  }

  return mergeTrees([
    actualTree,
    ...opts.watching
      .flatMap(w => {
        const pkgName = packageName(w);

        if (pkgName) {
          // if this refers to a package name, we watch all importable directories

          const pkgJsonPath = resolvePackagePath(pkgName, cwd);
          if (!pkgJsonPath) {
            throw new Error(
              `You specified "${pkgName}" as a package for broccoli-side-watch, but this package is not resolvable from ${cwd} `
            );
          }

          const pkgPath = dirname(pkgJsonPath);

          return getWatchedDirectories(pkgPath).map(relativeDir => join(pkgPath, relativeDir));
        } else {
          return [w];
        }
      })
      .map(path => {
        return new BroccoliNoOp(resolve(cwd, path));
      }),
  ]);
}

// We expose this as CJS, so make sure this transpiles to module.exports = sideWatch
export = sideWatch;
