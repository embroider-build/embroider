import { MacrosConfig } from '.';

export default function makeTransform(baseDir: string, config: MacrosConfig) {
  return function embroiderMacrosTransform(env: { moduleName: string, syntax: { builders: any } }) {

    let scopeStack: string[][] = [];

    return {
      name: '@embroider/macros',

      visitor: {
        Program: {
          enter(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.push(node.blockParams);
            }
          },
          exit(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.pop();
            }
          }
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'macroGetOwnConfig') {
            return getConfig(node, config, baseDir, true, env.syntax.builders);
          }
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'macroGetOwnConfig') {
            return env.syntax.builders.mustache(getConfig(node, config, baseDir, true, env.syntax.builders));
          }
        },
      }
    };
  };
}

function inScope(scopeStack: string[][], name: string) {
  for (let scope of scopeStack) {
    if (scope.includes(name)) {
      return true;
    }
  }
  return false;
}

function getConfig(node: any, config: MacrosConfig, baseDir: string, own: boolean, builders: any) {
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
  if (typeof targetConfig === 'number') {
    return builders.number(targetConfig);
  }
  if (typeof targetConfig === 'string') {
    return builders.string(targetConfig);
  }
  if (targetConfig === null) {
    return builders.null();
  }

  if (targetConfig === undefined) {
    return builders.undefined();
  }

  throw new Error(`unimplemented`);
}
