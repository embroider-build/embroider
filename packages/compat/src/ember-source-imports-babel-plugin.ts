import { explicitRelative } from '@embroider/core';
import type * as Babel from '@babel/core';
import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import { join, dirname, sep } from 'path';

export interface Options {
  dependenciesPath: string;
  emberDependencyPaths: string[];
}

interface State {
  opts: Options;
  filename: string;
  cwd: string;
}

export default function RelativeImportsBabelPlugin(babel: typeof Babel) {
  let t = babel.types;

  return {
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        let matchingImport = findMatchingImport(state.opts.emberDependencyPaths, path.node.source.value);
        if (!matchingImport) {
          return;
        }
        let { filename } = state;
        // Derp
        debugger;
        if (filename.replace(state.cwd, '').split(sep).length === 1) {
          filename = join(filename.replace(/\.js$/, ''), 'index.js');
        }
        // blerp
        if (filename.startsWith(join(state.cwd, 'ember-source'))) {
          filename = filename.replace('/ember-source', '');
        }
        let newImportSrc = explicitRelative(dirname(filename), join(state.cwd, 'dependencies', matchingImport));
        path.node.source = t.stringLiteral(newImportSrc);
      },
    },
  };
}

function findMatchingImport(emberDependencyPaths: string[], currentImport: string): string | undefined {
  currentImport = currentImport.replace(/\.js$/, '');
  return emberDependencyPaths.find(depPath => {
    return depPath.replace(/\.js$/, '') === currentImport;
  });
}
