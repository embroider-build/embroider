import literal from './literal';
import getConfig from './get-config';
import dependencySatisfies from './dependency-satisfies';
import { maybeAttrs } from './macro-maybe-attrs';
import { macroIfBlock, macroIfExpression } from './macro-condition';
import { failBuild } from './fail-build';

export function makeFirstTransform(opts: { userConfigs: { [packageRoot: string]: unknown }; baseDir?: string }) {
  function embroiderFirstMacrosTransform(env: {
    syntax: { builders: any };
    meta: { moduleName: string };
    filename: string;
  }) {
    if (!opts.baseDir && !env.filename) {
      throw new Error(`bug in @embroider/macros. Running without baseDir but don't have filename.`);
    }

    let scopeStack: string[][] = [];

    // baseDir is set when we run inside classic ember-cli. Otherwise we're in
    // Embroider, where we can use absolute filenames.
    const moduleName = opts.baseDir ? env.meta.moduleName : env.filename;

    return {
      name: '@embroider/macros/first',

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
          },
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'macroGetOwnConfig') {
            return literal(getConfig(node, opts.userConfigs, opts.baseDir, moduleName, true), env.syntax.builders);
          }
          if (node.path.original === 'macroGetConfig') {
            return literal(getConfig(node, opts.userConfigs, opts.baseDir, moduleName, false), env.syntax.builders);
          }
          if (node.path.original === 'macroDependencySatisfies') {
            return literal(dependencySatisfies(node, opts.baseDir, moduleName), env.syntax.builders);
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
            return env.syntax.builders.mustache(
              literal(getConfig(node, opts.userConfigs, opts.baseDir, moduleName, true), env.syntax.builders)
            );
          }
          if (node.path.original === 'macroGetConfig') {
            return env.syntax.builders.mustache(
              literal(getConfig(node, opts.userConfigs, opts.baseDir, moduleName, false), env.syntax.builders)
            );
          }
          if (node.path.original === 'macroDependencySatisfies') {
            return env.syntax.builders.mustache(
              literal(dependencySatisfies(node, opts.baseDir, moduleName), env.syntax.builders)
            );
          }
        },
      },
    };
  }
  (embroiderFirstMacrosTransform as any).embroiderMacrosASTMarker = true;
  (embroiderFirstMacrosTransform as any).parallelBabel = {
    requireFile: __filename,
    buildUsing: 'makeFirstTransform',
    get params() {
      return {
        userConfigs: opts.userConfigs,
        baseDir: opts.baseDir,
      };
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
          },
        },
        BlockStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'if') {
            return macroIfBlock(node);
          }
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'if') {
            return macroIfExpression(node, env.syntax.builders);
          }
          if (node.path.original === 'macroFailBuild') {
            failBuild(node);
          }
        },
        ElementNode(node: any) {
          node.modifiers = node.modifiers.filter((modifier: any) => {
            if (modifier.path.type !== 'PathExpression') {
              return true;
            }
            if (inScope(scopeStack, modifier.path.parts[0])) {
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
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'if') {
            return env.syntax.builders.mustache(macroIfExpression(node, env.syntax.builders));
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
