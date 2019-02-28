import { MacrosConfig } from '..';

export default function getConfig(node: any, config: MacrosConfig, baseDir: string, own: boolean) {
  let targetConfig;
  let params = node.params.slice();
  if (!params.every((p: any) => p.type === 'StringLiteral')) {
    throw new Error(`all arguments to ${own ? 'macroGetOwnConfig' : 'macroGetConfig'} must be string literals`);
  }

  if (own) {
    targetConfig = config.getOwnConfig(baseDir);
  } else {
    let packageName = params.shift();
    if (!packageName) {
      throw new Error(`macroGetConfig requires at least one argument`);
    }
    targetConfig = config.getConfig(baseDir, packageName.value);
  }
  while (typeof targetConfig === 'object' && targetConfig && params.length > 0) {
    let key = params.shift();
    targetConfig = targetConfig[key.value] as any;
  }
  return targetConfig;
}
