import type { RewrittenPackageCache } from '@embroider/shared-internals';

export default function getConfig(
  node: any,
  userConfigs: { [packageRoot: string]: unknown },
  // when we're running in traditional ember-cli, baseDir is configured and we
  // do all lookups relative to that (single) package. But when we're running in
  // embroider stage3 we process all packages simultaneously, so baseDir is left
  // unconfigured and moduleName will be the full path to the source file.
  baseDir: string | undefined,
  moduleName: string,
  own: boolean,
  packageCache: RewrittenPackageCache
) {
  let targetConfig;
  let params = node.params.slice();
  if (!params.every((p: any) => p.type === 'StringLiteral')) {
    throw new Error(`all arguments to ${own ? 'macroGetOwnConfig' : 'macroGetConfig'} must be string literals`);
  }

  let us = packageCache.ownerOfFile(baseDir || moduleName);
  if (!us) {
    return undefined;
  }

  if (own) {
    us = packageCache.original(us) || us;
    targetConfig = userConfigs[us.root];
  } else {
    let packageName = params.shift();
    if (!packageName) {
      throw new Error(`macroGetConfig requires at least one argument`);
    }
    let targetPkg = packageCache.resolve(packageName.value, us);
    targetPkg = packageCache.original(targetPkg) || targetPkg;
    targetConfig = userConfigs[targetPkg.root];
  }
  while (typeof targetConfig === 'object' && targetConfig && params.length > 0) {
    let key = params.shift();
    targetConfig = targetConfig[key.value] as any;
  }
  return targetConfig;
}
