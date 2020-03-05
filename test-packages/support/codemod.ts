import { transform } from '@babel/core';
import { readFileSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { NodePath } from '@babel/traverse';
import { CallExpression } from '@babel/types';
import { Identifier } from '@babel/types';
import { callExpression } from '@babel/types';
import { identifier } from '@babel/types';
import { memberExpression } from '@babel/types';

function codemod() {
  let visitor = {
    CallExpression(path: NodePath<CallExpression>) {
      let callee = path.get('callee') as NodePath<Identifier>;
      if (callee.node.name === 'assertDeepEqual') {
        let expect = callExpression(identifier('expect'), [path.get('arguments')[0].node]);
        path.replaceWith(
          callExpression(memberExpression(expect, identifier('toEqual')), [path.get('arguments')[1].node])
        );
      }
    },
  };
  return { visitor };
}

let target = join(__dirname, '../../packages/compat/tests/resolver.test.ts');
let src = readFileSync(target, 'utf8');

// let result = transform(src, {
//   plugins: ['@babel/plugin-syntax-typescript', codemod],
// })!.code!;

let result = src.replace(/configure\(\s*\{\s(\w)/g, function(_whole, char) {
  return 'configure({' + char;
});

writeFileSync(target, result);
