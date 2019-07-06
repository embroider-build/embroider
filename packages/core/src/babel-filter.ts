import PackageCache from './package-cache';
import Options from './options';
import semver from 'semver';

export default function babelFilter(skipBabel: Required<Options>['skipBabel']) {
  return function shouldTranspileFile(filename: string) {
    if (!babelCanHandle(filename)) {
      // quick exit for non JS extensions
      return false;
    }

    let owner = PackageCache.shared('embroider-stage3').ownerOfFile(filename);
    if (owner) {
      for (let { package: pkg, semverRange } of skipBabel) {
        if (owner.name === pkg && (semverRange == null || semver.satisfies(owner.version, semverRange))) {
          if (owner.isEmberPackage()) {
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
  // we can handle .js and .ts files with babel. If typescript is enabled, .ts
  // files become resolvable and stage3 will be asking us if they should get
  // transpiled and the answer is yes. If typescript is not enbled, they will
  // not be resolvable, so stage3 won't ask us about them.
  return /\.[jt]s$/i.test(filename);
}
