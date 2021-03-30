import { resolve } from 'path';
import { Portable, PortableHint } from './portable';
import type { NodeTemplateCompilerParams } from './template-compiler-node';
import jsStringEscape from 'js-string-escape';

export function templateCompilerModule(params: NodeTemplateCompilerParams, hints: PortableHint[]) {
  let p = new Portable({ hints });
  let result = p.dehydrate(params);
  return {
    src: [
      `const { NodeTemplateCompiler } = require("${jsStringEscape(
        resolve(__dirname, './template-compiler-node.js')
      )}");`,
      `const { Portable } = require("${jsStringEscape(resolve(__dirname, './portable.js'))}");`,
      `let p = new Portable({ hints: ${JSON.stringify(hints, null, 2)} });`,
      `module.exports = new NodeTemplateCompiler(p.hydrate(${JSON.stringify(result.value, null, 2)}))`,
    ].join('\n'),
    isParallelSafe: result.isParallelSafe,
  };
}
