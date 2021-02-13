import evaluate from './evaluate';

export function maybeModifier(node: any, builders: any) {
  let [predicate, originalModifier, ...positionalArgs] = node.params;

  if (!predicate) {
    throw new Error(`macroMaybeModifier requires at least one argument`);
  }

  let result = evaluate(predicate);
  if (!result.confident) {
    throw new Error(`first argument to macroMaybeModifier must be statically analyzable`);
  }

  if (originalModifier.type !== 'PathExpression') {
    throw new Error(`macroMaybeModifier found a ${originalModifier.type} where it expected a PathExpression`);
  }

  if (result.value) {
    return builders.elementModifier(originalModifier, positionalArgs, node.hash);
  } else {
    return false;
  }
}
