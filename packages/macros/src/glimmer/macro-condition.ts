import evaluate from './evaluate';

export function macroIfBlock(node: any) {
  let condition = node.params[0];

  if (!condition || condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
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

  if (!condition || condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
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

export function macroIfMustache(node: any, builders: any) {
  let result = macroIfExpression(node, builders);

  if (result === node) {
    return node;
  }

  if (result.type === 'SubExpression') {
    return builders.mustache(result.path, result.params, result.hash);
  }

  return builders.mustache(result);
}

export function macroUnlessBlock(node: any) {
  let condition = node.params[0];

  if (!condition || condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
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
    if (node.inverse) {
      return node.inverse.body;
    } else {
      return [];
    }
  } else {
    return node.program.body;
  }
}

export function macroUnlessExpression(node: any, builders: any) {
  let condition = node.params[0];

  if (!condition || condition.type !== 'SubExpression' || condition.path.original !== 'macroCondition') {
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
    return node.params[2] || builders.undefined();
  } else {
    return node.params[1];
  }
}

export function macroUnlessMustache(node: any, builders: any) {
  let result = macroUnlessExpression(node, builders);

  if (result === node) {
    return node;
  }

  if (result.type === 'SubExpression') {
    return builders.mustache(result.path, result.params, result.hash);
  }

  return builders.mustache(result);
}
