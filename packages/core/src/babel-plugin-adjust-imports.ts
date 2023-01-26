import { join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { Options as ModuleResolveroptions } from './module-resolver';

export type Options = Pick<ModuleResolveroptions, 'extraImports'>;

interface State {
  opts: Options | DeflatedOptions;
}

export interface DeflatedOptions {
  adjustImportsOptionsPath: string;
  relocatedFilesPath: string;
}

type BabelTypes = typeof t;

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          let opts = ensureOpts(state);
          let adder = new ImportUtil(t, path);
          addExtraImports(adder, t, path, opts.extraImports);
        },
      },
    },
  };
}

(main as any).baseDir = function () {
  return join(__dirname, '..');
};

function addExtraImports(
  adder: ImportUtil,
  t: BabelTypes,
  path: NodePath<t.Program>,
  extraImports: Required<Options>['extraImports']
) {
  for (let { absPath, target, runtimeName } of extraImports) {
    if (absPath === path.hub.file.opts.filename) {
      if (runtimeName) {
        path.node.body.unshift(amdDefine(t, adder, path, target, runtimeName));
      } else {
        adder.importForSideEffect(target);
      }
    }
  }
}

function amdDefine(t: BabelTypes, adder: ImportUtil, path: NodePath<t.Program>, target: string, runtimeName: string) {
  let value = t.callExpression(adder.import(path, '@embroider/macros', 'importSync'), [t.stringLiteral(target)]);
  return t.expressionStatement(
    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
      t.stringLiteral(runtimeName),
      t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ])
  );
}

function ensureOpts(state: State): Options {
  let { opts } = state;
  if ('adjustImportsOptionsPath' in opts) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (state.opts = { ...require(opts.adjustImportsOptionsPath), ...require(opts.relocatedFilesPath) });
  }
  return opts;
}
