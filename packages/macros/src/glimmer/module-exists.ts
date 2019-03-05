import resolve from "resolve";
import { dirname } from "path";
import literal from "./literal";

export function moduleExistsExpression(node: any, baseDir: string | undefined, moduleName: string, builders: any) {
  let result = moduleExists(node, baseDir, moduleName);
  if (typeof result === 'boolean') {
    return literal(result, builders);
  }
  return builders.subexpression('todo');
}

export function moduleExistsMustache(node: any, baseDir: string | undefined, moduleName: string, builders: any) {
  let result = moduleExists(node, baseDir, moduleName);
  if (typeof result === 'boolean') {
    return builders.mustache(literal(result, builders));
  }
  return builders.mustache('todo');
}

function moduleExists(
  node: any,
  // when we're running in traditional ember-cli, baseDir is configured and we
  // do all lookups relative to that (single) package. But when we're running in
  // embroider stage3 we process all packages simultaneously, so baseDir is left
  // unconfigured and moduleName will be the full path to the source file.
  baseDir: string | undefined,
  moduleName: string
) {

  if (node.params.length !== 1) {
    throw new Error(`macroModuleExists requires one argument, you passed ${node.params.length}`);
  }

  if (node.params[0].type !== 'StringLiteral') {
    throw new Error(`argument to macroModuleExists must be a string literal`);
  }

  let checkModuleName = node.params[0].value;

  if (baseDir) {
    return { runtime: node.params };
  } else {
    try {
      resolve.sync(checkModuleName, { basedir: dirname(moduleName) });
      return true;
    } catch (err) {
      return false;
    }
  }
}
