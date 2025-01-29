import type * as Babel from '@babel/core';
import { transformAsync } from '@babel/core';

export interface MetaResult {
  templateSource: string;
  scope: Map<
    string,
    {
      local: string;
      imported: string;
      module: string;
    }
  >;
}

interface ExtractMetaOpts {
  result: MetaResult | undefined;
}

/*
  This only needs to be able to parse the output of our own transforms, it's not
  necessary that it covers every possible way of expressing a template in
  javascript
*/
function extractMetaPlugin(_babel: typeof Babel): Babel.PluginObj<{ opts: ExtractMetaOpts }> {
  return {
    visitor: {
      CallExpression(path, state) {
        if (path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate')) {
          let [arg0, arg1] = path.node.arguments;
          if (arg0.type !== 'StringLiteral') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          if (!arg1) {
            // empty scope
            let scope: MetaResult['scope'] = new Map();
            state.opts.result = {
              templateSource: arg0.value,
              scope,
            };
            return;
          }

          if (arg1.type !== 'ObjectExpression') {
            throw new Error(`unexpected source: ${String(path)}`);
          }

          let prop0 = arg1.properties[0];
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

          let scope: MetaResult['scope'] = new Map();
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
            let binding = path.scope.bindings[value.name];
            if (binding?.path.type === 'ImportDefaultSpecifier') {
              let dec = binding.path.parentPath as Babel.NodePath<Babel.types.ImportDeclaration>;
              scope.set(key.name, { local: value.name, imported: 'default', module: dec.node.source.value });
            } else if (binding?.path.type === 'ImportSpecifier') {
              let dec = binding.path.parentPath as Babel.NodePath<Babel.types.ImportDeclaration>;
              let specifier = binding.path.node as Babel.types.ImportSpecifier;
              let imported: string;
              if (specifier.imported.type === 'Identifier') {
                imported = specifier.imported.name;
              } else {
                imported = specifier.imported.value;
              }
              scope.set(key.name, { local: value.name, imported, module: dec.node.source.value });
            } else {
              throw new Error(`unepxected binding.path.type: ${binding?.path.type}`);
            }
          }

          state.opts.result = {
            templateSource: arg0.value,
            scope,
          };
        }
      },
    },
  };
}

export async function extractMeta(source: string, filename: string) {
  const meta: ExtractMetaOpts = { result: undefined };
  await transformAsync(source, {
    filename,
    plugins: [[extractMetaPlugin, meta]],
  });
  if (!meta.result) {
    throw new Error(`failed to extract metadata while processing ${filename}`);
  }
  return meta.result;
}
