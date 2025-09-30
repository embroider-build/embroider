import { satisfies } from 'semver';
import type { RewrittenPackageCache } from '@embroider/shared-internals';

const packageName = 'ember-source';

export default function appEmberSatisfies(node: any, packageCache: RewrittenPackageCache) {
  if (node.params.length !== 1) {
    throw new Error(`macroAppEmberSatisfies requires only one argument, you passed ${node.params.length}`);
  }

  if (!node.params.every((p: any) => p.type === 'StringLiteral')) {
    throw new Error(`all arguments to macroAppEmberSatisfies must be string literals`);
  }

  let root = packageCache.get(packageCache.appRoot);
  let range = node.params[0].value;

  if (!root?.hasDependency(packageName)) {
    return false;
  }

  let pkg;
  try {
    pkg = packageCache.resolve(packageName, root);
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
