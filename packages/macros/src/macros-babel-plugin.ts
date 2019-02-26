import { NodePath } from '@babel/traverse';
import { ImportDeclaration } from '@babel/types';
import State from './state';
import modulePresent from './modulePresent';
import dependencySatisfies from './dependencySatisfies';

export default function main() {
  return {
    visitor: {
      Program: {
        enter(_: NodePath, state: State) {
          state.removed = [];
        },
        exit(_: NodePath, state: State) {
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
              if (binding.referencePaths.every(path => Boolean(path.findParent(p => state.removed.includes(p))))) {
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
        if (path.referencesImport('@embroider/macros', 'modulePresent')) {
          modulePresent(path, state);
        }
        if (path.referencesImport('@embroider/macros', 'dependencySatisfies')) {
          dependencySatisfies(path, state);
        }
      },
    }
  };
}
