import { MacrosConfig } from '..';
import literal from './literal';
import getConfig from './get-config';

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
            return literal(getConfig(node, config, baseDir, true), env.syntax.builders);
          }
          if (node.path.original === 'macroGetConfig') {
            return literal(getConfig(node, config, baseDir, false), env.syntax.builders);
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
            return env.syntax.builders.mustache(literal(getConfig(node, config, baseDir, true), env.syntax.builders));
          }
          if (node.path.original === 'macroGetConfig') {
            return env.syntax.builders.mustache(literal(getConfig(node, config, baseDir, false), env.syntax.builders));
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
