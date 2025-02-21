import { type NodePath, traverse, type types } from '@babel/core';
import codeFrame from '@babel/code-frame';

const { codeFrameColumns } = codeFrame;

export interface RenderTest {
  startIndex: number;
  endIndex: number;
  statementStart: number;
  availableBinding: string;
}

export async function identifyRenderTests(ast: types.File, source: string, filename: string): Promise<RenderTest[]> {
  let renderTests: RenderTest[] = [];

  function fail(node: types.Node, message: string) {
    let m = `[${filename}] ${message}`;
    if (node.loc) {
      m = m + '\n' + codeFrameColumns(source, node.loc);
    }
    return new Error(m);
  }

  traverse(ast, {
    CallExpression(path) {
      if (path.get('callee').referencesImport('@ember/test-helpers', 'render')) {
        let [arg0] = path.get('arguments');
        if (isLooseHBS(arg0)) {
          let loc = arg0.node.loc;
          if (!loc) {
            throw new Error(`bug: no locations provided by babel`);
          }

          let counter = 0;
          let availableBinding = 'self';
          while (path.scope.getBinding(availableBinding)) {
            availableBinding = `self${counter++}`;
          }

          let statementCandidate: NodePath<unknown> = path;
          while (!statementCandidate.isStatement()) {
            statementCandidate = statementCandidate.parentPath;
          }

          renderTests.push({
            startIndex: loc.start.index,
            endIndex: loc.end.index,
            statementStart: statementCandidate.node.loc!.start.index,
            availableBinding,
          });
        } else {
          throw fail(arg0.node, `unsupported syntax in rendering test (${arg0.type})`);
        }
      }
    },
  });
  return renderTests;
}

function isLooseHBS(path: NodePath<unknown>) {
  let callee: NodePath<unknown> | undefined;
  if (path.isTaggedTemplateExpression()) {
    callee = path.get('tag');
  } else if (path.isCallExpression()) {
    callee = path.get('callee');
  }

  return (
    callee?.isReferencedIdentifier() &&
    (callee.referencesImport('ember-cli-htmlbars', 'hbs') ||
      callee.referencesImport('@ember/template-compilation', 'precompileTemplate'))
  );
}
