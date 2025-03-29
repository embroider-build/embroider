import type * as Babel from '@babel/core';
import { transformFromAstAsync, type types } from '@babel/core';
import { isLooseHBS } from './detect-inline-hbs.js';

interface ExtractMetaOpts {
  result: { templateSource: string }[];
}

function extractMetaPlugin(_babel: typeof Babel): Babel.PluginObj<{ opts: ExtractMetaOpts }> {
  return {
    visitor: {
      TaggedTemplateExpression(path, state) {
        if (isLooseHBS(path)) {
          state.opts.result.push({
            templateSource: path.node.quasi.quasis[0].value.raw,
          });
        }
      },
      CallExpression(path, state) {
        let check = isLooseHBS(path);
        if (!check) {
          return;
        }

        if (check.supportsScope) {
          let [arg0, arg1] = path.node.arguments;
          if (arg0.type !== 'StringLiteral') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          if (!arg1) {
            state.opts.result.push({
              templateSource: arg0.value,
            });
            return;
          }

          if (arg1.type !== 'ObjectExpression') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          let prop0 = arg1.properties[0];
          if (!prop0) {
            state.opts.result.push({
              templateSource: arg0.value,
            });
            return;
          }

          if (prop0.type !== 'ObjectProperty') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          let value = prop0.value;
          if (value.type !== 'ArrowFunctionExpression') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          let body = value.body;
          if (body.type !== 'ObjectExpression') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          for (let prop of body.properties) {
            if (prop.type !== 'ObjectProperty') {
              throw new Error(`unexpected source: ${String(path)}`);
            }
            let key = prop.key;
            let value = prop.value;

            if (key.type !== 'Identifier') {
              throw new Error(`unexpected source: ${String(path)}`);
            }
            if (value.type !== 'Identifier') {
              throw new Error(`unexpected source: ${String(path)}`);
            }
            if (key.name !== value.name) {
              throw new Error(`bug: unexpected name remapping`);
            }
          }

          state.opts.result.push({
            templateSource: arg0.value,
          });
        } else {
          let [arg0] = path.node.arguments;
          if (arg0.type !== 'StringLiteral') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          state.opts.result.push({
            templateSource: arg0.value,
          });
        }
      },
    },
  };
}

function extractLoc(node: types.Node): { start: number; end: number } {
  let { loc } = node;
  if (!loc) {
    throw new Error(`bug: parse should have loc info`);
  }
  return { start: loc.start.index, end: loc.end.index };
}

export async function extractTemplates(ast: types.File, filename: string) {
  const meta: ExtractMetaOpts = { result: [] };
  await transformFromAstAsync(ast, undefined, {
    configFile: false,
    filename,
    plugins: [[extractMetaPlugin, meta]],
  });
  if (!meta.result) {
    throw new Error(`failed to extract metadata while processing ${filename}`);
  }
  return meta.result;
}

interface ComponentClassLocation {
  loc: { start: number; end: number };
  bodyNode: types.ClassBody;
}

interface TemplateOnlyComponentLocation {
  loc: { start: number; end: number };
  tocNode: types.CallExpression;
}

interface LocatePluginOpts {
  templates: { start: number; end: number }[];
  component: ComponentClassLocation | TemplateOnlyComponentLocation | { problem: string } | undefined;
}

function locatePlugin(_babel: typeof Babel): Babel.PluginObj<{ opts: LocatePluginOpts }> {
  return {
    visitor: {
      ExportDefaultDeclaration(path, state) {
        // We need to resolve the path to the exported value, so start with the
        // export declaration, which might be the value in simple cases like
        //
        // ```js
        // export default class Foo {};
        // ```
        //
        // or
        //
        // ```ts
        // export default templateOnlyComponent<FooSignature>();
        // ```
        let valuePath: Babel.NodePath<unknown> = path.get('declaration');

        if (valuePath.isIdentifier()) {
          // This is an export of an identifier, not the value, e.g.
          //
          // ```js
          // class Foo {};
          // export default Foo;
          // ```
          //
          // or
          //
          // ```ts
          // const Foo = templateOnlyComponent<FooSignature>();
          // export default Foo;
          // ```
          let binding = path.scope.getBinding(valuePath.node.name);
          if (!binding) {
            throw new Error(`bug: unable to get binding for identifier: ${valuePath.node.name}`);
          }

          if (binding.path.isVariableDeclarator()) {
            // It's a variable declarator, e.g.
            //
            // ```ts
            // const Foo = templateOnlyComponent<FooSignature>();
            // export default Foo;
            // ```
            valuePath = binding.path.get('init');
            if (!valuePath) {
              throw new Error(`bug: unable to get init for variable declarator: ${binding.path}`);
            }
          } else {
            // It's something else, e.g.
            //
            // ```js
            // class Foo {};
            // export default Foo;
            // ```
            //
            // (we'll handle the possible cases below)
            valuePath = binding.path;
          }
        }

        if (valuePath.isClassDeclaration() || valuePath.isClassExpression()) {
          state.opts.component = { loc: extractLoc(valuePath.node.body), bodyNode: valuePath.node.body };
          return;
        } else if (valuePath.isCallExpression()) {
          let callee = valuePath.get('callee');
          if (
            callee.node.type === 'MemberExpression' &&
            callee.node.property.type === 'Identifier' &&
            callee.node.property.name === 'extend'
          ) {
            state.opts.component = {
              problem: `This codemod does not support old styles Component.extend() syntax. Convert to a native class first.`,
            };
            return;
          }

          if (callee.referencesImport('@ember/component/template-only', 'default')) {
            state.opts.component = { loc: extractLoc(valuePath.node), tocNode: valuePath.node };
            return;
          }
        } else if (valuePath.isTSInterfaceDeclaration()) {
          // ignoring type-only export
          return;
        }

        state.opts.component = {
          problem: `The default export from this JS file is not something we understand. Found ${valuePath.type}`,
        };
      },
      CallExpression(path, state) {
        if (path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate')) {
          state.opts.templates.push(extractLoc(path.node));
        }
      },
    },
  };
}

export async function locateTemplates(ast: types.File, filename: string): Promise<LocatePluginOpts> {
  const meta: LocatePluginOpts = { component: undefined, templates: [] };
  await transformFromAstAsync(ast, undefined, {
    configFile: false,
    filename,
    plugins: [[locatePlugin, meta]],
  });
  if (!meta.component) {
    throw new Error(`failed to locate component template insertion point in ${filename}`);
  }
  return meta;
}
