import resolve from 'resolve';
import { dirname } from 'path';
import { NodePath } from '@babel/traverse';
import { ImportDeclaration, booleanLiteral } from '@babel/types';

interface State {
  removed: NodePath[];
}

export default function main() {
  return {
    visitor: {
      Program: {
        enter(_: NodePath, state: State) {
          state.removed = [];
        },
        exit(_: NodePath, state: State) {
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
          if (path.parent.type !== 'CallExpression') {
            throw new Error(`You can only use modulePresent as a function call`);
          }
          if (path.parent.arguments.length !== 1) {
            throw new Error(`modulePresent takes exactly one argument, you passed ${path.parent.arguments.length}`);
          }
          let arg = path.parent.arguments[0];
          if (arg.type !== 'StringLiteral') {
            throw new Error(`the argument to modulePresent must be a string literal`);
          }
          let sourceFileName = path.hub.file.opts.filename;
          try {
            resolve.sync(arg.value, { basedir: dirname(sourceFileName) });
            path.parentPath.replaceWith(booleanLiteral(true));
          } catch (err) {
            path.parentPath.replaceWith(booleanLiteral(false));
          }
          state.removed.push(path.parentPath);
        }
      },
    }
  };
}
