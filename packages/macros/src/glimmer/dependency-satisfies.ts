import { satisfies, parse } from 'semver';
import type { PackageCache } from '@embroider/shared-internals';

export default function dependencySatisfies(
  node: any,
  // when we're running in traditional ember-cli, baseDir is configured and we
  // do all lookups relative to that (single) package. But when we're running in
  // embroider stage3 we process all packages simultaneously, so baseDir is left
  // unconfigured and moduleName will be the full path to the source file.
  baseDir: string | undefined,
  moduleName: string,
  packageCache: PackageCache
) {
  if (node.params.length !== 2) {
    throw new Error(`macroDependencySatisfies requires two arguments, you passed ${node.params.length}`);
  }

  if (!node.params.every((p: any) => p.type === 'StringLiteral')) {
    throw new Error(`all arguments to macroDependencySatisfies must be string literals`);
  }

  let packageName = node.params[0].value;
  let range = node.params[1].value;

  let us = packageCache.ownerOfFile(baseDir || moduleName);
  if (!us?.hasDependency(packageName)) {
    return false;
  }

  let pkg;
  try {
    pkg = packageCache.resolve(packageName, us);
  } catch (err) {
    // it's not an error if we can't resolve it, we just don't satisfy it.
  }

  if (pkg) {
    let satisfied = satisfies(pkg.version, range, {
      includePrerelease: true,
    });

    // version === '*'
    if (pkg.version === undefined || pkg.version === '*') {
      return true;
    }

    // if a pre-release version is used, we need to check that separate,
    // because `includePrerelease` only applies to the range argument of `range`.
    if (!satisfied) {
      let parsedVersion = parse(pkg.version);

      if (parsedVersion && parsedVersion.prerelease.length > 0) {
        let { major, minor, patch } = parsedVersion;
        let bareVersion = `${major}.${minor}.${patch}`;

        return satisfies(bareVersion, range, {
          includePrerelease: true,
        });
      }
    }

    return satisfied;
  }
  return false;
}
