import { NodePath } from '@babel/traverse';
import {
  CallExpression,
  Identifier,
  memberExpression,
  identifier,
  IfStatement,
  ConditionalExpression,
  ForOfStatement,
  FunctionDeclaration,
} from '@babel/types';
import { PackageCache } from '@embroider/core';
import State, { sourceFile } from './state';
import dependencySatisfies from './dependency-satisfies';
import moduleExists from './module-exists';
import getConfig, { inlineRuntimeConfig } from './get-config';
import macroCondition, { isMacroConditionPath } from './macro-condition';
import { isEachPath, prepareEachPath } from './each';

import error from './error';
import failBuild from './fail-build';

const packageCache = PackageCache.shared('embroider-stage3');

export default function main() {
  let visitor = {
    Program: {
      enter(_: NodePath, state: State) {
        state.generatedRequires = new Set();
        state.jobs = [];
        state.removed = new Set();
        state.calledIdentifiers = new Set();
      },
      exit(path: NodePath, state: State) {
        pruneMacroImports(path, state);
        for (let handler of state.jobs) {
          handler();
        }
      },
    },
    'IfStatement|ConditionalExpression': {
      enter(path: NodePath<IfStatement | ConditionalExpression>, state: State) {
        if (isMacroConditionPath(path)) {
          state.calledIdentifiers.add(path.get('test').get('callee').node);
        }
      },
      exit(path: NodePath<IfStatement | ConditionalExpression>, state: State) {
        if (isMacroConditionPath(path)) {
          macroCondition(path, state);
        }
      },
    },
    ForOfStatement: {
      enter(path: NodePath<ForOfStatement>, state: State) {
        if (isEachPath(path)) {
          state.calledIdentifiers.add(path.get('right').get('callee').node);
        }
      },
      exit(path: NodePath<ForOfStatement>, state: State) {
        if (isEachPath(path)) {
          prepareEachPath(path, state);
        }
      },
    },
    FunctionDeclaration: {
      enter(path: NodePath<FunctionDeclaration>, state: State) {
        let id = path.get('id');
        if (id.isIdentifier() && id.node.name === 'initializeRuntimeMacrosConfig') {
          let pkg = packageCache.ownerOfFile(sourceFile(path, state));
          if (pkg && pkg.name === '@embroider/macros') {
            inlineRuntimeConfig(path, state);
          }
        }
      },
    },
    CallExpression: {
      enter(path: NodePath<CallExpression>, state: State) {
        let callee = path.get('callee');
        if (callee.referencesImport('@embroider/macros', 'dependencySatisfies')) {
          state.calledIdentifiers.add(callee.node);
          dependencySatisfies(path, state, packageCache);
        }
        if (callee.referencesImport('@embroider/macros', 'moduleExists')) {
          state.calledIdentifiers.add(callee.node);
          moduleExists(path, state);
        }
        if (callee.referencesImport('@embroider/macros', 'getConfig')) {
          state.calledIdentifiers.add(callee.node);
          getConfig(path, state, packageCache, false);
        }
        if (callee.referencesImport('@embroider/macros', 'getOwnConfig')) {
          state.calledIdentifiers.add(callee.node);
          getConfig(path, state, packageCache, true);
        }
        if (callee.referencesImport('@embroider/macros', 'failBuild')) {
          state.calledIdentifiers.add(callee.node);
          failBuild(path, state);
        }
        if (callee.referencesImport('@embroider/macros', 'importSync')) {
          let r = identifier('require');
          state.generatedRequires.add(r);
          callee.replaceWith(r);
        }
      },
    },
    ReferencedIdentifier(path: NodePath<Identifier>, state: State) {
      for (let candidate of [
        'dependencySatisfies',
        'moduleExists',
        'getConfig',
        'getOwnConfig',
        'failBuild',
        'importSync',
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
        path.node.name === 'require' &&
        !state.generatedRequires.has(path.node) &&
        !path.scope.hasBinding('require') &&
        ownedByEmberPackage(path, state)
      ) {
        // Our importSync macro has been compiled to `require`. But we want to
        // distinguish that from any pre-existing, user-written `require` in an
        // Ember addon, which should retain its *runtime* meaning.
        path.replaceWith(memberExpression(identifier('window'), path.node));
      }
    },
  };
  return { visitor };
}

// This removes imports from "@embroider/macros" itself, because we have no
// runtime behavior at all.
function pruneMacroImports(path: NodePath, state: State) {
  if (!path.isProgram() || state.opts.mode === 'run-time') {
    return;
  }
  for (let topLevelPath of path.get('body')) {
    if (topLevelPath.isImportDeclaration() && topLevelPath.get('source').node.value === '@embroider/macros') {
      topLevelPath.remove();
    }
  }
}

function ownedByEmberPackage(path: NodePath, state: State) {
  let filename = sourceFile(path, state);
  let pkg = packageCache.ownerOfFile(filename);
  return pkg && pkg.isEmberPackage();
}
