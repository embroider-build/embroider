import evaluate from './evaluate';

export function maybeAttrs(elementNode: any, node: any, builders: any) {
  let [predicate, ...bareAttrs] = node.params;

  if (!predicate) {
    throw new Error(`macroMaybeAttrs requires at least one argument`);
  }

  let result = evaluate(predicate);
  if (!result.confident) {
    throw new Error(`first argument to macroMaybeAttrs must be statically analyzable`);
  }

  for (let bareAttr of bareAttrs) {
    if (bareAttr.type !== 'PathExpression') {
      throw new Error(`macroMaybeAttrs found a ${bareAttr.type} where it expected a PathExpression`);
    }
  }

  if (result.value) {
    for (let bareAttr of bareAttrs) {
      elementNode.attributes.push(builders.attr(bareAttr.original, builders.text('')));
    }

    for (let attr of node.hash.pairs) {
      elementNode.attributes.push(builders.attr(attr.key, builders.mustache(attr.value)));
    }
  }
}
