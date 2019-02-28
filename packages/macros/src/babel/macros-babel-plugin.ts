import { NodePath } from '@babel/traverse';
import { ImportDeclaration } from '@babel/types';
import { PackageCache } from '@embroider/core';
import State from './state';
import dependencySatisfies from './dependency-satisfies';
import getConfig from './get-config';
import ifMacro from './if-macro';

// we're assuming parallelized babel, so this doesn't try to share with anybody
// other than our own module scope. As an optimization we could optionally
// accept an existing PackageCache in our plugin config.
const packageCache = new PackageCache();

export default function main() {
  return {
    visitor: {
      Program: {
        enter(_: NodePath, state: State) {
          state.removed = [];
          state.pendingTasks = [];
        },
        exit(_: NodePath, state: State) {
          state.pendingTasks.forEach(task => task());
          // Here we prune away the imports of macros that only exist at compile
          // time.
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
      },
      ReferencedIdentifier(path: NodePath, state: State) {
        if (path.referencesImport('@embroider/macros', 'dependencySatisfies')) {
          dependencySatisfies(path, state, packageCache);
        }
        if (path.referencesImport('@embroider/macros', 'getConfig')) {
          getConfig(path, state, packageCache, false);
        }
        if (path.referencesImport('@embroider/macros', 'getOwnConfig')) {
          getConfig(path, state, packageCache, true);
        }
        if (path.referencesImport('@embroider/macros', 'ifMacro')) {
          state.pendingTasks.push(() => ifMacro(path, state));
        }
      },
    }
  };
}

function wasRemoved(path: NodePath, state: State) {
  return Boolean(path.findParent(p => state.removed.includes(p)));
}
