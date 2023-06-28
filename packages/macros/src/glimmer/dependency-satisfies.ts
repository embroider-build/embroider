import { satisfies } from 'semver';
import type { RewrittenPackageCache } from '@embroider/shared-internals';

export default function dependencySatisfies(
  node: any,
  // when we're running in traditional ember-cli, baseDir is configured and we
  // do all lookups relative to that (single) package. But when we're running in
  // embroider stage3 we process all packages simultaneously, so baseDir is left
  // unconfigured and moduleName will be the full path to the source file.
  baseDir: string | undefined,
  moduleName: string,
  packageCache: RewrittenPackageCache
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
    return satisfies(pkg.version, range, {
      includePrerelease: true,
    });
  }
  return false;
}
