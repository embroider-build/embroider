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
        let source = path.node.source.value;
        let newSource = handleSource(source, state);
        if (newSource !== source) {
          path.node.source = t.stringLiteral(newSource);
        }
      },
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, state: State) {
        if (path.node.source) {
          let source = path.node.source.value;
          let newSource = handleSource(source, state);
          if (newSource !== source) {
            path.node.source = t.stringLiteral(newSource);
          }
        }
      },
    },
  };
}

function handleSource(source: string, state: State): string {
  let matchingImport = findMatchingImport(state.opts.emberDependencyPaths, source);
  if (!matchingImport) {
    return source;
  }
  let { filename } = state;
  // Derp
  if (filename.replace(state.cwd + sep, '').split(sep).length === 1) {
    filename = join(filename.replace(/\.js$/, ''), 'index.js');
  }
  // blerp
  if (filename.startsWith(join(state.cwd, 'ember-source'))) {
    filename = filename.replace('/ember-source', '');
  }
  return explicitRelative(dirname(filename), join(state.cwd, 'dependencies', matchingImport));
}

function findMatchingImport(emberDependencyPaths: string[], currentImport: string): string | undefined {
  currentImport = currentImport.replace(/\.js$/, '');
  return emberDependencyPaths.find(depPath => {
    return depPath.replace(/\.js$/, '') === currentImport;
  });
}
