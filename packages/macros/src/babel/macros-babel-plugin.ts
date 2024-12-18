import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import type State from './state';
import { initState } from './state';
import type { Mode as GetConfigMode } from './get-config';
import { inlineRuntimeConfig, insertConfig } from './get-config';
import macroCondition, { isMacroConditionPath } from './macro-condition';
import { isEachPath, insertEach } from './each';

import error from './error';
import failBuild from './fail-build';
import { Evaluator, buildLiterals } from './evaluate-json';
import type * as Babel from '@babel/core';

export default function main(context: typeof Babel): unknown {
  let t = context.types;
  let visitor = {
    Program: {
      enter(path: NodePath<t.Program>, state: State) {
        initState(t, path, state);
      },
      exit(_: NodePath<t.Program>, state: State) {
        // @embroider/macros itself has no runtime behaviors and should always be removed
        state.importUtil.removeAllImports('@embroider/macros');
        for (let handler of state.jobs) {
          handler();
        }
      },
    },
    'IfStatement|ConditionalExpression': {
      enter(path: NodePath<t.IfStatement | t.ConditionalExpression>, state: State) {
        if (isMacroConditionPath(path)) {
          state.calledIdentifiers.add(path.get('test').get('callee').node);
          macroCondition(path, state);
        }
      },
    },
    ForOfStatement: {
      enter(path: NodePath<t.ForOfStatement>, state: State) {
        if (isEachPath(path)) {
          state.calledIdentifiers.add(path.get('right').get('callee').node);
          insertEach(path, state, context);
        }
      },
    },
    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>, state: State) {
        let id = path.get('id');
        if (id.isIdentifier() && id.node.name === 'initializeRuntimeMacrosConfig' && state.opts.mode === 'run-time') {
          let pkg = state.owningPackage();
          if (pkg && pkg.name === '@embroider/macros') {
            inlineRuntimeConfig(path, state, context);
          }
        }
      },
    },
    CallExpression: {
      enter(path: NodePath<t.CallExpression>, state: State) {
        let callee = path.get('callee');
        if (!callee.isIdentifier()) {
          return;
        }

        // failBuild is implemented for side-effect, not value, so it's not
        // handled by evaluateMacroCall.
        if (callee.referencesImport('@embroider/macros', 'failBuild')) {
          state.calledIdentifiers.add(callee.node);
          failBuild(path, state);
          return;
        }

        if (callee.referencesImport('@embroider/macros', 'importSync')) {
          // we handle importSync in the exit hook
          return;
        }

        // getOwnConfig/getGlobalConfig/getConfig needs special handling, so
        // even though it also emits values via evaluateMacroCall when they're
        // needed recursively by other macros, it has its own insertion-handling
        // code that we invoke here.
        //
        // The things that are special include:
        //  - automatic collapsing of chained properties, etc
        //  - these macros have runtime implementations sometimes, which changes
        //    how we rewrite them
        let mode: GetConfigMode | false = callee.referencesImport('@embroider/macros', 'getOwnConfig')
          ? 'own'
          : callee.referencesImport('@embroider/macros', 'getGlobalConfig')
          ? 'getGlobalConfig'
          : callee.referencesImport('@embroider/macros', 'getConfig')
          ? 'package'
          : false;
        if (mode) {
          state.calledIdentifiers.add(callee.node);
          insertConfig(path, state, mode, context);
          return;
        }

        // isTesting can have a runtime implementation. At compile time it
        // instead falls through to evaluateMacroCall.
        if (callee.referencesImport('@embroider/macros', 'isTesting') && state.opts.mode === 'run-time') {
          state.calledIdentifiers.add(callee.node);
          callee.replaceWith(state.importUtil.import(callee, state.pathToOurAddon('runtime'), 'isTesting'));
          return;
        }

        let result = new Evaluator({ state }).evaluateMacroCall(path);
        if (result.confident) {
          state.calledIdentifiers.add(callee.node);
          path.replaceWith(buildLiterals(result.value, context));
        }
      },
      exit(path: NodePath<t.CallExpression>, state: State) {
        let callee = path.get('callee');
        if (!callee.isIdentifier()) {
          return;
        }
        // importSync doesn't evaluate to a static value, so it's implemented
        // directly here, not in evaluateMacroCall.
        // We intentionally do this on exit here, to allow other transforms to handle importSync before we do
        // For example ember-auto-import needs to do some custom transforms to enable use of dynamic template strings,
        // so its babel plugin needs to see and handle the importSync call first!
        if (callee.referencesImport('@embroider/macros', 'importSync')) {
          if (state.opts.importSyncImplementation === 'eager') {
            let specifier = path.node.arguments[0];
            if (specifier?.type !== 'StringLiteral') {
              throw new Error(`importSync eager mode doesn't implement non string literal arguments yet`);
            }
            path.replaceWith(state.importUtil.import(path, specifier.value, '*'));
            state.calledIdentifiers.add(callee.node);
          } else {
            if (path.scope.hasBinding('require')) {
              path.scope.rename('require');
            }
            let r = t.identifier('require');
            state.generatedRequires.add(r);
            path.replaceWith(
              t.callExpression(state.importUtil.import(path, state.pathToOurAddon('es-compat2.js'), 'default', 'esc'), [
                t.callExpression(r, path.node.arguments),
              ])
            );
          }
          return;
        }
      },
    },
    ReferencedIdentifier(path: NodePath<t.Identifier>, state: State) {
      for (let candidate of [
        'dependencySatisfies',
        'moduleExists',
        'getConfig',
        'getOwnConfig',
        'failBuild',
        // we cannot check importSync, as the babel transform runs on exit, so *after* this check
        // 'importSync',
        'isDevelopingApp',
        'isDevelopingThisPackage',
        'isTesting',
      ]) {
        if (path.referencesImport('@embroider/macros', candidate) && !state.calledIdentifiers.has(path.node)) {
          throw error(path, `You can only use ${candidate} as a function call`);
        }
      }

      if (path.referencesImport('@embroider/macros', 'macroCondition') && !state.calledIdentifiers.has(path.node)) {
        throw error(path, `macroCondition can only be used as the predicate of an if statement or ternary expression`);
      }

      if (path.referencesImport('@embroider/macros', 'each') && !state.calledIdentifiers.has(path.node)) {
        throw error(
          path,
          `the each() macro can only be used within a for ... of statement, like: for (let x of each(thing)){}`
        );
      }

      if (state.opts.owningPackageRoot) {
        // there is only an owningPackageRoot when we are running inside a
        // classic ember-cli build. In the embroider stage3 build, there is no
        // owning package root because we're compiling *all* packages
        // simultaneously.
        //
        // given that we're inside classic ember-cli, stop here without trying
        // to rewrite bare `require`. It's not needed, because both our
        // `importSync` and any user-written bare `require` can both mean the
        // same thing: runtime AMD `require`.
        return;
      }

      if (
        state.opts.importSyncImplementation === 'cjs' &&
        path.node.name === 'require' &&
        !state.generatedRequires.has(path.node) &&
        !path.scope.hasBinding('require') &&
        state.owningPackage().isEmberPackage()
      ) {
        // Our importSync macro has been compiled to `require`. But we want to
        // distinguish that from any pre-existing, user-written `require` in an
        // Ember addon, which should retain its *runtime* meaning.
        path.replaceWith(t.memberExpression(t.identifier('window'), path.node));
      }
    },
  };

  if ((context as any).types.OptionalMemberExpression) {
    // our getConfig and getOwnConfig macros are supposed to be able to absorb
    // optional chaining. To make that work we need to see the optional chaining
    // before preset-env compiles them away.
    (visitor as any).OptionalMemberExpression = {
      enter(path: NodePath<t.OptionalMemberExpression>, state: State) {
        if (state.opts.mode === 'compile-time') {
          let result = new Evaluator({ state }).evaluate(path);
          if (result.confident) {
            path.replaceWith(buildLiterals(result.value, context));
          }
        }
      },
    };
  }

  return { visitor };
}
