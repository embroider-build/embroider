import { NodePath } from '@babel/traverse';
import {
  CallExpression,
  Identifier,
  memberExpression,
  identifier,
  IfStatement,
  ConditionalExpression,
} from '@babel/types';
import { PackageCache } from '@embroider/core';
import State, { sourceFile } from './state';
import dependencySatisfies from './dependency-satisfies';
import getConfig from './get-config';
import macroCondition from './macro-condition';
import error from './error';
import failBuild from './fail-build';
import { bindState } from './visitor';

const packageCache = PackageCache.shared('embroider-stage3');

export default function main() {
  let visitor = {
    Program: {
      enter(_: NodePath, state: State) {
        state.generatedRequires = new Set();
      },
      exit(path: NodePath) {
        pruneMacroImports(path);
      },
    },
    IfStatement(path: NodePath<IfStatement>, state: State) {
      let test = path.get('test');
      if (test.isCallExpression()) {
        let callee = test.get('callee');
        if (callee.referencesImport('@embroider/macros', 'macroCondition')) {
          macroCondition(path, test, bindState(visitor, state));
        }
      }
    },
    ConditionalExpression(path: NodePath<ConditionalExpression>, state: State) {
      let test = path.get('test');
      if (test.isCallExpression()) {
        let callee = test.get('callee');
        if (callee.referencesImport('@embroider/macros', 'macroCondition')) {
          macroCondition(path, test, bindState(visitor, state));
        }
      }
    },
    CallExpression(path: NodePath<CallExpression>, state: State) {
      let callee = path.get('callee');
      if (callee.referencesImport('@embroider/macros', 'dependencySatisfies')) {
        dependencySatisfies(path, state, packageCache);
      }
      if (callee.referencesImport('@embroider/macros', 'getConfig')) {
        getConfig(path, state, packageCache, false);
      }
      if (callee.referencesImport('@embroider/macros', 'getOwnConfig')) {
        getConfig(path, state, packageCache, true);
      }
      if (callee.referencesImport('@embroider/macros', 'failBuild')) {
        failBuild(path, bindState(visitor, state));
      }
      if (callee.referencesImport('@embroider/macros', 'importSync')) {
        let r = identifier('require');
        state.generatedRequires.add(r);
        callee.replaceWith(r);
      }
    },
    ReferencedIdentifier(path: NodePath<Identifier>, state: State) {
      if (path.referencesImport('@embroider/macros', 'dependencySatisfies')) {
        throw error(path, `You can only use dependencySatisfies as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'getConfig')) {
        throw error(path, `You can only use getConfig as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'getOwnConfig')) {
        throw error(path, `You can only use getOwnConfig as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'macroCondition')) {
        throw error(path, `macroCondition can only be used as the predicate of an if statement or ternary expression`);
      }
      if (path.referencesImport('@embroider/macros', 'failBuild')) {
        throw error(path, `You can only use failBuild as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'importSync')) {
        throw error(path, `You can only use importSync as a function call`);
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
function pruneMacroImports(path: NodePath) {
  if (!path.isProgram()) {
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
