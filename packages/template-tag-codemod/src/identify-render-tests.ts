import { type NodePath, parseAsync, traverse, type types } from '@babel/core';
import { createRequire } from 'module';
import codeFrame from '@babel/code-frame';

const require = createRequire(import.meta.url);
const { codeFrameColumns } = codeFrame;

export interface RenderTest {
  node: types.Node;
  startIndex: number;
  endIndex: number;
  templateContent: string;
}

export async function identifyRenderTests(
  source: string,
  filename: string
): Promise<{ renderTests: RenderTest[]; parsed: types.File }> {
  let renderTests: RenderTest[] = [];
  let parsed = await parseAsync(source, {
    filename,
    plugins: [
      [require.resolve('@babel/plugin-syntax-decorators'), { legacy: true }],
      require.resolve('@babel/plugin-syntax-typescript'),
    ],
  });

  if (!parsed) {
    throw new Error(`bug, unexpected output from babel parseAsync`);
  }

  function fail(node: types.Node, message: string) {
    let m = `[${filename}] ${message}`;
    if (node.loc) {
      m = m + '\n' + codeFrameColumns(source, node.loc);
    }
    return new Error(m);
  }

  traverse(parsed, {
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
            renderTests.push({
              node: arg0.node,
              startIndex: loc.start.index,
              endIndex: loc.end.index,
              templateContent: arg0.node.quasi.quasis[0].value.raw,
            });
          }
        } else {
          throw fail(arg0.node, `unsupported syntax in rendering test (${arg0.type})`);
        }
      }
    },
  });
  return { renderTests, parsed };
}

function isLooseHBS(path: NodePath<types.Expression>) {
  if (path.isReferencedIdentifier()) {
    if (path.referencesImport('ember-cli-htmlbars', 'hbs')) {
      return true;
    }
  }
  return false;
}
