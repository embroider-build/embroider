import { type NodePath, traverse, type types } from '@babel/core';
import codeFrame from '@babel/code-frame';
import { isLooseHBS } from './detect-inline-hbs.js';

const { codeFrameColumns } = codeFrame;

export interface RenderTest {
  startIndex: number;
  endIndex: number;
  availableBinding: () => { identifier: string; needsInsertAt: number | null };
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

  let availableBindings = new Map<number, RenderTest['availableBinding']>();

  function handleTemplate(templatePath: NodePath) {
    let loc = templatePath.node.loc;
    if (!loc) {
      throw new Error(`bug: no locations provided by babel`);
    }

    let target = startOfScope(templatePath);
    let availableBinding = availableBindings.get(target);
    if (!availableBinding) {
      let counter = 0;
      let identifier = 'self';
      while (templatePath.scope.getBinding(identifier)) {
        identifier = `self${counter++}`;
      }

      let inserted = false;
      availableBinding = () => {
        let needsInsertAt: number | null = null;
        if (!inserted) {
          needsInsertAt = target;
          inserted = true;
        }
        return {
          identifier,
          needsInsertAt,
        };
      };
      availableBindings.set(target, availableBinding);
    }

    renderTests.push({
      startIndex: loc.start.index,
      endIndex: loc.end.index,
      availableBinding,
    });
  }

  traverse(ast, {
    CallExpression(path) {
      if (path.get('callee').referencesImport('@ember/test-helpers', 'render')) {
        let [arg0] = path.get('arguments');
        if (isLooseHBS(arg0)) {
          handleTemplate(arg0);
          return;
        }
        if (arg0.isIdentifier()) {
          let binding = arg0.scope.getBinding(arg0.node.name);
          let definition = binding?.path;
          if (definition?.isVariableDeclarator()) {
            let init = definition.get('init');
            if (isLooseHBS(init)) {
              if (binding?.references === 1) {
                handleTemplate(init as NodePath);
                return;
              } else {
                throw fail(
                  arg0.node,
                  `unsupported syntax in rendering test: local variable "${arg0.node.name}" is a template but it's used in multiple places. We can only rewrite it automatically when it's used exactly once in a call to render()`
                );
              }
            }
          }
        }
        throw fail(arg0.node, `unsupported syntax in rendering test (${arg0.type})`);
      }
    },
  });
  return renderTests;
}

function startOfScope(path: NodePath<unknown>): number {
  let block: NodePath<unknown> = path;
  while (!block.isBlock() && !block.isProgram()) {
    block = block.parentPath;
  }
  let target: number = block.node.loc!.start.index;
  if (block.isBlock()) {
    // actual blocks have a start curly and our scope begins after that
    target = target + 1;
  } else {
    // this is the Program case, our scope starts right where the Program starts
  }
  return target;
}
