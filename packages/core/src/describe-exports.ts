import { parse, TransformOptions } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import { types as t } from '@babel/core';
import assertNever from 'assert-never';

export function describeExports(code: string, babelParserConfig: TransformOptions): { names: Set<string> } {
  let ast = parse(code, babelParserConfig);
  if (!ast || ast.type !== 'File') {
    throw new Error(`bug in embroider/core describe-exports`);
  }
  let names: Set<string> = new Set();

  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      for (let spec of path.node.specifiers) {
        switch (spec.type) {
          case 'ExportSpecifier':
          case 'ExportNamespaceSpecifier':
            const name = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value;

            names.add(name);
            break;
          case 'ExportDefaultSpecifier':
            // this is in the types but was never standardized
            break;
          default:
            assertNever(spec);
        }
      }
      if (t.isVariableDeclaration(path.node.declaration)) {
        for (let dec of path.node.declaration.declarations) {
          if (t.isIdentifier(dec.id)) {
            names.add(dec.id.name);
          }
        }
      }
      if (t.isFunctionDeclaration(path.node.declaration) || t.isClassDeclaration(path.node.declaration)) {
        if (t.isIdentifier(path.node.declaration.id)) {
          names.add(path.node.declaration.id.name);
        }
      }
    },
    ExportDefaultDeclaration(_path: NodePath<t.ExportDefaultDeclaration>) {
      names.add('default');
    },
  });
  return { names };
}
