import literal from './literal';
import getConfig from './get-config';
import appEmberSatisfies from './app-ember-satisfies';
import dependencySatisfies from './dependency-satisfies';
import { maybeAttrs } from './macro-maybe-attrs';
import {
  macroIfBlock,
  macroIfExpression,
  macroIfMustache,
  macroUnlessBlock,
  macroUnlessExpression,
  macroUnlessMustache,
} from './macro-condition';
import { failBuild } from './fail-build';
import { RewrittenPackageCache } from '@embroider/shared-internals';

export interface BuildPluginParams {
  // Glimmer requires this on ast transforms.
  name: string;

  // this is the location of @embroider/macros itself. Glimmer requires this on
  // ast transforms.
  baseDir: string;

  methodName: string;

  firstTransformParams: FirstTransformParams;
}

export interface FirstTransformParams {
  // this is the location of the particular package (app or addon) that is
  // depending on @embroider/macros *if* we're in a classic build. Under
  // embroider the build is global and there's no single packageRoot.
  packageRoot: string | undefined;

  // this is the path to the topmost package
  appRoot: string;

  // this holds all the actual user configs that were sent into the macros
  configs: { [packageRoot: string]: object };
}

export function buildPlugin(params: BuildPluginParams) {
  return {
    name: params.name,
    plugin:
      params.methodName === 'makeFirstTransform'
        ? makeFirstTransform(params.firstTransformParams)
        : makeSecondTransform(),
    baseDir: () => params.baseDir,
  };
}

export function makeFirstTransform(opts: FirstTransformParams) {
  function embroiderFirstMacrosTransform(env: {
    syntax: { builders: any };
    meta: { moduleName: string };
    filename: string;
  }) {
    if (!opts.packageRoot && !env.filename) {
      throw new Error(`bug in @embroider/macros. Running without packageRoot but don't have filename.`);
    }

    let packageCache = RewrittenPackageCache.shared('embroider', opts.appRoot);

    let scopeStack: string[][] = [];

    // packageRoot is set when we run inside classic ember-cli. Otherwise we're in
    // Embroider, where we can use absolute filenames.
    const moduleName = opts.packageRoot ? env.meta.moduleName : env.filename;

    return {
      name: '@embroider/macros/first',

      visitor: {
        ...scopeVisitors(env, scopeStack),
        SubExpression(node: any, walker: { parent: { node: any } }) {
          if (node.path.type !== 'PathExpression') {
            return;
          }

          if (inScope(scopeStack, headOf(node.path))) {
            return;
          }

          if (node.path.original === 'macroGetOwnConfig') {
            return literal(
              getConfig(node, opts.configs, opts.packageRoot, moduleName, true, packageCache),
              env.syntax.builders
            );
          }
          if (node.path.original === 'macroGetConfig') {
            return literal(
              getConfig(node, opts.configs, opts.packageRoot, moduleName, false, packageCache),
              env.syntax.builders
            );
          }
          if (node.path.original === 'macroDependencySatisfies') {
            const staticValue = literal(
              dependencySatisfies(node, opts.packageRoot, moduleName, packageCache),
              env.syntax.builders
            );
            // If this is a macro expression by itself, then turn it into a macroCondition for the second pass to prune.
            // Otherwise assume it's being composed with another macro and evaluate it as a literal
            if (walker.parent.node.path.original === 'if') {
              return env.syntax.builders.sexpr('macroCondition', [staticValue]);
            }
            return staticValue;
          }
          if (node.path.original === 'macroAppEmberSatisfies') {
            const staticValue = literal(appEmberSatisfies(node, packageCache), env.syntax.builders);
            // If this is a macro expression by itself, then turn it into a macroCondition for the second pass to prune.
            // Otherwise assume it's being composed with another macro and evaluate it as a literal
            if (walker.parent.node.path.original === 'if') {
              return env.syntax.builders.sexpr('macroCondition', [staticValue]);
            }
            return staticValue;
          }
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }

          if (inScope(scopeStack, headOf(node.path))) {
            return;
          }
          if (node.path.original === 'macroGetOwnConfig') {
            return env.syntax.builders.mustache(
              literal(
                getConfig(node, opts.configs, opts.packageRoot, moduleName, true, packageCache),
                env.syntax.builders
              )
            );
          }
          if (node.path.original === 'macroGetConfig') {
            return env.syntax.builders.mustache(
              literal(
                getConfig(node, opts.configs, opts.packageRoot, moduleName, false, packageCache),
                env.syntax.builders
              )
            );
          }
          if (node.path.original === 'macroDependencySatisfies') {
            return env.syntax.builders.mustache(
              literal(dependencySatisfies(node, opts.packageRoot, moduleName, packageCache), env.syntax.builders)
            );
          }
          if (node.path.original === 'macroAppEmberSatisfies') {
            return env.syntax.builders.mustache(literal(appEmberSatisfies(node, packageCache), env.syntax.builders));
          }
        },
      },
    };
  }
  (embroiderFirstMacrosTransform as any).embroiderMacrosASTMarker = true;
  (embroiderFirstMacrosTransform as any).parallelBabel = {
    requireFile: __filename,
    buildUsing: 'makeFirstTransform',
    get params(): FirstTransformParams {
      return opts;
    },
  };
  return embroiderFirstMacrosTransform;
}

export function makeSecondTransform() {
  function embroiderSecondMacrosTransform(env: { syntax: { builders: any } }) {
    let scopeStack: string[][] = [];
    return {
      name: '@embroider/macros/second',

      visitor: {
        ...scopeVisitors(env, scopeStack),
        BlockStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }

          if (inScope(scopeStack, headOf(node.path))) {
            return;
          }
          if (node.path.original === 'if') {
            return macroIfBlock(node);
          }
          if (node.path.original === 'unless') {
            return macroUnlessBlock(node);
          }
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }

          if (inScope(scopeStack, headOf(node.path))) {
            return;
          }
          if (node.path.original === 'if') {
            return macroIfExpression(node, env.syntax.builders);
          }
          if (node.path.original === 'unless') {
            return macroUnlessExpression(node, env.syntax.builders);
          }
          if (node.path.original === 'macroFailBuild') {
            failBuild(node);
          }
        },
        ElementNode(node: any) {
          node.modifiers = node.modifiers.filter((modifier: any) => {
            if (
              modifier.path.type === 'SubExpression' &&
              modifier.path.path.type === 'PathExpression' &&
              modifier.path.path.original === 'if'
            ) {
              modifier.path = macroIfExpression(modifier.path, env.syntax.builders);
              if (modifier.path.type === 'UndefinedLiteral') {
                return false;
              }
            }
            if (
              modifier.path.type === 'SubExpression' &&
              modifier.path.path.type === 'PathExpression' &&
              modifier.path.path.original === 'unless'
            ) {
              modifier.path = macroUnlessExpression(modifier.path, env.syntax.builders);
              if (modifier.path.type === 'UndefinedLiteral') {
                return false;
              }
            }
            if (modifier.path.type !== 'PathExpression') {
              return true;
            }

            if (inScope(scopeStack, headOf(node.path))) {
              return true;
            }
            if (modifier.path.original === 'macroMaybeAttrs') {
              maybeAttrs(node, modifier, env.syntax.builders);
            } else {
              return true;
            }
          });
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }

          if (inScope(scopeStack, headOf(node.path))) {
            return;
          }
          if (node.path.original === 'if') {
            return macroIfMustache(node, env.syntax.builders);
          }
          if (node.path.original === 'unless') {
            return macroUnlessMustache(node, env.syntax.builders);
          }
          if (node.path.original === 'macroFailBuild') {
            failBuild(node);
          }
        },
      },
    };
  }
  (embroiderSecondMacrosTransform as any).embroiderMacrosASTMarker = true;
  (embroiderSecondMacrosTransform as any).parallelBabel = {
    requireFile: __filename,
    buildUsing: 'makeSecondTransform',
    params: undefined,
  };
  return embroiderSecondMacrosTransform;
}

function inScope(scopeStack: string[][], name: string) {
  for (let scope of scopeStack) {
    if (scope.includes(name)) {
      return true;
    }
  }
  return false;
}

function headOf(path: any) {
  if (!path) return;

  return 'head' in path ? path.head.name : path.parts[0];
}

function scopeVisitors(env: any, scopeStack: string[][]) {
  function enter(node: any) {
    if (node.blockParams.length > 0) {
      scopeStack.push(node.blockParams);
    }
  }
  function exit(node: any) {
    if (node.blockParams.length > 0) {
      scopeStack.pop();
    }
  }

  let hasTemplate = 'template' in env.syntax.builders;
  if (hasTemplate) {
    return {
      Template: { enter, exit },
      Block: { enter, exit },
    };
  } else {
    return {
      Program: { enter, exit },
    };
  }
}
