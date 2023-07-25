import type { NodePath } from '@babel/traverse';
import State from './state';
import { RewrittenPackageCache, Package } from '@embroider/shared-internals';
import error from './error';
import { Evaluator, assertArray, buildLiterals, ConfidentResult } from './evaluate-json';
import assertNever from 'assert-never';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';

export type Mode = 'own' | 'getGlobalConfig' | 'package';

function getPackage(path: NodePath<t.CallExpression>, state: State, mode: 'own' | 'package'): { root: string } | null {
  let packageName: string | undefined;
  if (mode === 'own') {
    if (path.node.arguments.length !== 0) {
      throw error(path, `getOwnConfig takes zero arguments, you passed ${path.node.arguments.length}`);
    }
    packageName = undefined;
  } else if (mode === 'package') {
    if (path.node.arguments.length !== 1) {
      throw error(path, `getConfig takes exactly one argument, you passed ${path.node.arguments.length}`);
    }
    let packageNode = path.node.arguments[0];
    if (packageNode.type !== 'StringLiteral') {
      throw error(assertArray(path.get('arguments'))[0], `the argument to getConfig must be a string literal`);
    }
    packageName = packageNode.value;
  } else {
    assertNever(mode);
  }
  return targetPackage(state.originalOwningPackage(), packageName, state.packageCache);
}

// this evaluates to the actual value of the config. It can be used directly by the Evaluator.
export default function getConfig(path: NodePath<t.CallExpression>, state: State, mode: Mode) {
  let config: unknown | undefined;
  if (mode === 'getGlobalConfig') {
    return state.opts.globalConfig;
  }
  let pkg = getPackage(path, state, mode);
  if (pkg) {
    config = state.opts.userConfigs[pkg.root];
  }
  return config;
}

// this is the imperative version that's invoked directly by the babel visitor
// when we encounter getConfig. It's implemented in terms of getConfig so we can
// be sure we have the same semantics.
export function insertConfig(path: NodePath<t.CallExpression>, state: State, mode: Mode, context: typeof Babel) {
  if (state.opts.mode === 'compile-time') {
    let config = getConfig(path, state, mode);
    let collapsed = collapse(path, config);
    let literalResult = buildLiterals(collapsed.config, context);
    collapsed.path.replaceWith(literalResult);
  } else {
    if (mode === 'getGlobalConfig') {
      let callee = path.get('callee');
      callee.replaceWith(state.importUtil.import(callee, state.pathToOurAddon('runtime'), 'getGlobalConfig'));
    } else {
      let pkg = getPackage(path, state, mode);
      let pkgRoot;
      if (pkg) {
        pkgRoot = context.types.stringLiteral(pkg.root);
      } else {
        pkgRoot = context.types.identifier('undefined');
      }
      path.replaceWith(
        context.types.callExpression(state.importUtil.import(path, state.pathToOurAddon('runtime'), 'config'), [
          pkgRoot,
        ])
      );
    }
  }
}

function targetPackage(
  us: Package,
  packageName: string | undefined,
  packageCache: RewrittenPackageCache
): Package | null {
  if (!packageName) {
    return us;
  }
  try {
    let target = packageCache.resolve(packageName, us);
    return packageCache.original(target);
  } catch (err) {
    return null;
  }
}

function collapse(path: NodePath, config: unknown) {
  let evaluator = new Evaluator({
    knownPaths: new Map([[path, { confident: true, value: config, hasRuntimeImplementation: false }]]),
  });

  while (true) {
    let parentPath = path.parentPath!;
    let result = evaluator.evaluate(parentPath);
    if (!result.confident || parentPath.isAssignmentExpression()) {
      return { path, config: (evaluator.evaluate(path) as ConfidentResult).value };
    }
    path = parentPath;
  }
}

export function inlineRuntimeConfig(path: NodePath<t.FunctionDeclaration>, state: State, context: typeof Babel) {
  path.get('body').node.body = [
    context.types.returnStatement(
      buildLiterals({ packages: state.opts.userConfigs, global: state.opts.globalConfig }, context)
    ),
  ];
}
