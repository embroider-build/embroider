import type * as Babel from '@babel/core';
import { transformFromAstAsync, type types } from '@babel/core';

export interface ExtractedTemplate {
  templateSource: string;
  scope: Map<string, string>;
}

interface ExtractMetaOpts {
  result: ExtractedTemplate[];
}

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
            let scope: ExtractedTemplate['scope'] = new Map();
            state.opts.result.push({
              templateSource: arg0.value,
              scope,
            });
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

          let scope: ExtractedTemplate['scope'] = new Map();
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
            scope.set(key.name, value.name);
          }

          state.opts.result.push({
            templateSource: arg0.value,
            scope,
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

interface LocatePluginOpts {
  templates: { start: number; end: number }[];
  componentBody: { loc: { start: number; end: number }; node: types.ClassBody } | undefined;
}

function locatePlugin(_babel: typeof Babel): Babel.PluginObj<{ opts: LocatePluginOpts }> {
  return {
    visitor: {
      ExportDefaultDeclaration(path, state) {
        let dec = path.node.declaration;
        switch (dec.type) {
          case 'ClassDeclaration':
          case 'ClassExpression':
            state.opts.componentBody = { loc: extractLoc(dec.body), node: dec.body };
            return;
          default:
            throw new Error(`unimplemented declaration: ${dec.type}`);
        }
      },
      CallExpression(path, state) {
        if (path.get('callee').referencesImport('@ember/template-compilation', 'precompileTemplate')) {
          state.opts.templates.push(extractLoc(path.node));
        }
      },
    },
  };
}

export async function locateTemplates(ast: types.File, filename: string) {
  const meta: LocatePluginOpts = { componentBody: undefined, templates: [] };
  await transformFromAstAsync(ast, undefined, {
    configFile: false,
    filename,
    plugins: [[locatePlugin, meta]],
  });
  if (!meta.componentBody) {
    throw new Error(`failed to locate component template insertion point in ${filename}`);
  }
  return meta;
}
