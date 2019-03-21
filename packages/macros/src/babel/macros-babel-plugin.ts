import { NodePath } from '@babel/traverse';
import { ImportDeclaration, CallExpression } from '@babel/types';
import { PackageCache } from '@embroider/core';
import State from './state';
import dependencySatisfies from './dependency-satisfies';
import getConfig from './get-config';
import macroIf from './macro-if';
import error from './error';
import { bindState } from './visitor';

const packageCache = PackageCache.shared('embroider-stage3');

export default function main() {
  let visitor = {
    Program: {
      enter(_: NodePath, state: State) {
        state.removed = [];
        state.pendingTasks = [];
      },
      exit(path: NodePath, state: State) {
        state.pendingTasks.forEach(task => task());
        pruneRemovedImports(state);
        pruneMacroImports(path);
      },
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
      if (callee.referencesImport('@embroider/macros', 'macroIf')) {
        macroIf(path, state, bindState(visitor, state));
      }
    },
    ReferencedIdentifier(path: NodePath) {
      if (path.referencesImport('@embroider/macros', 'dependencySatisfies')) {
        throw error(path, `You can only use dependencySatisfies as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'getConfig')) {
        throw error(path, `You can only use getConfig as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'getOwnConfig')) {
        throw error(path, `You can only use getOwnConfig as a function call`);
      }
      if (path.referencesImport('@embroider/macros', 'macroIf')) {
        throw error(path, `You can only use macroIf as a function call`);
      }
    },
  };
  return { visitor };
}

function wasRemoved(path: NodePath, state: State) {
  return state.removed.includes(path) || Boolean(path.findParent(p => state.removed.includes(p)));
}

// This removes imports that are only referred to from within code blocks that
// we killed.
function pruneRemovedImports(state: State) {
  if (state.removed.length === 0) {
    return;
  }
  let moduleScope = state.removed[0].findParent(path => path.type === 'Program').scope;
  for (let name of Object.keys(moduleScope.bindings)) {
    let binding = moduleScope.bindings[name];
    let bindingPath = binding.path;
    if (bindingPath.isImportSpecifier() || bindingPath.isImportDefaultSpecifier()) {
      if (binding.referencePaths.length > 0 && binding.referencePaths.every(path => wasRemoved(path, state))) {
        bindingPath.remove();
        let importPath = bindingPath.parentPath as NodePath<ImportDeclaration>;
        if (importPath.get('specifiers').length === 0) {
          importPath.remove();
        }
      }
    }
  }
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
