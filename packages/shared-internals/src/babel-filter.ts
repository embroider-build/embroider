import PackageCache from './package-cache';
import semver from 'semver';

export default function babelFilter(skipBabel: { package: string; semverRange?: string }[], appRoot: string) {
  return function shouldTranspileFile(filename: string) {
    if (!babelCanHandle(filename)) {
      // quick exit for non JS extensions
      return false;
    }

    let owner = PackageCache.shared('embroider', appRoot).ownerOfFile(filename);
    if (owner) {
      for (let { package: pkg, semverRange } of skipBabel) {
        if (owner.name === pkg && (semverRange == null || semver.satisfies(owner.version, semverRange))) {
          if (owner.isEmberAddon()) {
            throw new Error(
              `You can't use skipBabel to disable transpilation of Ember addons, it only works for non-Ember third-party packages`
            );
          }
          return false;
        }
      }
    }
    return true;
  };
}

function babelCanHandle(filename: string) {
  // we can handle .mjs, .js and .ts files with babel. If typescript is enabled,
  // .ts files become resolvable and stage3 will be asking us if they should get
  // transpiled and the answer is yes. If typescript is not enbled, they will
  // not be resolvable, so stage3 won't ask us about them.
  return /\.m?[jt]s$/i.test(filename);
}
