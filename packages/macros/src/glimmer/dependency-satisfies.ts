import { MacrosConfig } from '..';
import { satisfies } from 'semver';

export default function dependencySatisfies(
  node: any,
  config: MacrosConfig,
  // when we're running in traditional ember-cli, baseDir is configured and we
  // do all lookups relative to that (single) package. But when we're running in
  // embroider stage3 we process all packages simultaneously, so baseDir is left
  // unconfigured and moduleName will be the full path to the source file.
  baseDir: string | undefined,
  moduleName: string
) {
  if (node.params.length !== 2) {
    throw new Error(`macroDependencySatisfies requires two arguments, you passed ${node.params.length}`);
  }

  if (!node.params.every((p: any) => p.type === 'StringLiteral')) {
    throw new Error(`all arguments to macroDependencySatisfies must be string literals`);
  }

  let packageName = node.params[0].value;
  let range = node.params[1].value;
  let pkg;
  try {
    pkg = config.resolvePackage(baseDir || moduleName, packageName);
  } catch (err) {}
  return (pkg && satisfies(pkg.version, range)) || false;
}
