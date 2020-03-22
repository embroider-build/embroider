export default function evaluate(node: any): { confident: true; value: any } | { confident: false } {
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
