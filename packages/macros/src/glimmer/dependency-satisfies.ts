import { MacrosConfig } from '..';
import { satisfies } from 'semver';

export default function dependencySatisfies(node: any, config: MacrosConfig, baseDir: string) {

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
    pkg = config.resolvePackage(baseDir, packageName);
  } catch (err) {}
  return (pkg && satisfies(pkg.version, range)) || false;
}
