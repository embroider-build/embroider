
export function macroIfBlock(node: any) {

  if (node.params.length !== 1) {
    throw new Error(`macroIf (block form) requires one arguments, you passed ${node.params.length}`);
  }

  let result = evaluate(node.params[0]);
  if (!result.confident) {
    throw new Error(`first argument to macroIf must be statically analyzable`)
  }

  if (result.value) {
    return node.program.body;
  } else {
    if (node.inverse) {
      return node.inverse.body;
    } else {
      return [];
    }
  }

}

function evaluate(node: any): { confident: true, value: any } | { confident: false } {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'UndefinedLiteral':
      return { confident: true, value: node.value };
    default:
      return { confident: false };
  }
}
