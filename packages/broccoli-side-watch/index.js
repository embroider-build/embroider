const { dirname, join } = require('path');
const mergeTrees = require('broccoli-merge-trees');
const { WatchedDir } = require('broccoli-source');
const { getWatchedDirectories, packageName } = require('@embroider/shared-internals');
const resolvePackagePath = require('resolve-package-path');

/*
  Doesn't change your actualTree, but causes a rebuild when any of opts.watching
  trees change.

  This is helpful when your build pipeline doesn't naturally watch some
  dependencies that you're actively developing. For example, right now
  @embroider/webpack doesn't rebuild itself when non-ember libraries change.
*/
module.exports = function sideWatch(actualTree, opts) {
  const cwd = opts.cwd ?? process.cwd();

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
        return new WatchedDir(path);
      }),
  ]);
};
