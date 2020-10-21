import { parse, TransformOptions } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  isVariableDeclaration,
  isIdentifier,
  Identifier,
} from '@babel/types';
import assertNever from 'assert-never';

export function describeExports(
  code: string,
  babelParserConfig: TransformOptions
): { names: Set<string>; hasDefaultExport: boolean } {
  let ast = parse(code, babelParserConfig);
  if (!ast || ast.type !== 'File') {
    throw new Error(`bug in embroider/core describe-exports`);
  }
  let names: Set<string> = new Set();
  let hasDefaultExport = false;

  // FIXME: the `any` cast here is only needed because of some NPM version
  // shenanigans between the various babel packages and typings.
  traverse(ast as any, {
    ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
      for (let spec of path.node.specifiers) {
        switch (spec.type) {
          case 'ExportSpecifier':
          case 'ExportNamespaceSpecifier':
            if ((spec.exported as Identifier).name === 'default') {
              hasDefaultExport = true;
            } else {
              names.add((spec.exported as Identifier).name);
            }
            break;
          case 'ExportDefaultSpecifier':
            // this is in the types but was never standardized
            break;
          default:
            assertNever(spec);
        }
      }
      if (isVariableDeclaration(path.node.declaration)) {
        for (let dec of path.node.declaration.declarations) {
          if (isIdentifier(dec.id)) {
            names.add(dec.id.name);
          }
        }
      }
    },
    ExportDefaultDeclaration(_path: NodePath<ExportDefaultDeclaration>) {
      hasDefaultExport = true;
    },
  });
  return { names, hasDefaultExport };
}
