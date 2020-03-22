import evaluate from './evaluate';

export function macroIfBlock(node: any) {
  let condition = node.params[0];

  if (condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
    return node;
  }

  if (condition.params.length !== 1) {
    throw new Error(`macroCondition requires one arguments, you passed ${node.params.length}`);
  }

  let result = evaluate(condition.params[0]);
  if (!result.confident) {
    throw new Error(`argument to macroCondition must be statically analyzable`);
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

export function macroIfExpression(node: any, builders: any) {
  let condition = node.params[0];

  if (condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
    return node;
  }

  if (condition.params.length !== 1) {
    throw new Error(`macroCondition requires one arguments, you passed ${node.params.length}`);
  }

  let result = evaluate(condition.params[0]);
  if (!result.confident) {
    throw new Error(`argument to macroCondition must be statically analyzable`);
  }

  if (result.value) {
    return node.params[1];
  } else {
    return node.params[2] || builders.undefined();
  }
}
