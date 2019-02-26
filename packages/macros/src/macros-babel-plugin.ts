import resolve from 'resolve';
import { dirname } from 'path';

interface State {
  removed: any[];
}

export default function main({ types: t} : { types: any }){
  return {
    visitor: {
      Program: {
        enter(_: any, state: State) {
          state.removed = [];
        },
        exit(_: any, state: State) {
          if (state.removed.length === 0) {
            return;
          }
          let moduleScope = state.removed[0].findParent((path: any) => path.type === 'Program').scope;
          for (let name of Object.keys(moduleScope.bindings)) {
            let binding = moduleScope.bindings[name];
            let bindingPath = binding.path;
            if (bindingPath.isImportSpecifier() || bindingPath.isImportDefaultSpecifier()) {
              if (binding.referencePaths.every((path: any) => Boolean(path.findParent((p: any) => state.removed.includes(p))))) {
                bindingPath.remove();
                let importPath = bindingPath.parentPath;
                if (importPath.get('specifiers').length === 0) {
                  importPath.remove();
                }
              }
            }
          }

        }
      },
      ReferencedIdentifier(path: any, state: State) {
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
            path.parentPath.replaceWith(t.booleanLiteral(true));
          } catch (err) {
            path.parentPath.replaceWith(t.booleanLiteral(false));
          }
          state.removed.push(path.parentPath);
        }
      },
    }
  };
}
