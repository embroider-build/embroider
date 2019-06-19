import PackageCache from './package-cache';
import Options from './options';
import semver from 'semver';

export default function babelFilter(skipBabel: Required<Options>['skipBabel']) {
  return function shouldTranspileFile(filename: string) {
    if (!isJS(filename)) {
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

function isJS(filename: string) {
  return /\.js$/i.test(filename);
}
