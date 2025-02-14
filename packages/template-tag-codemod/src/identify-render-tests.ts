import { type NodePath, traverse, type types } from '@babel/core';
import codeFrame from '@babel/code-frame';

const { codeFrameColumns } = codeFrame;

export interface RenderTest {
  node: types.Node;
  startIndex: number;
  endIndex: number;
  templateContent: string;
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
        if (arg0.isTaggedTemplateExpression()) {
          let tag = arg0.get('tag');
          if (isLooseHBS(tag)) {
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
              node: arg0.node,
              startIndex: loc.start.index,
              endIndex: loc.end.index,
              templateContent: arg0.node.quasi.quasis[0].value.raw,
              statementStart: statementCandidate.node.loc!.start.index,
              availableBinding,
            });
          }
        } else {
          throw fail(arg0.node, `unsupported syntax in rendering test (${arg0.type})`);
        }
      }
    },
  });
  return renderTests;
}

function isLooseHBS(path: NodePath<types.Expression>) {
  if (path.isReferencedIdentifier()) {
    if (path.referencesImport('ember-cli-htmlbars', 'hbs')) {
      return true;
    }
  }
  return false;
}
