import type { ASTPluginBuilder } from '@glimmer/syntax';

export function replaceThisTransform(replacement: string): ASTPluginBuilder {
  const transform: ASTPluginBuilder = ({ syntax: { builders } }) => {
    return {
      name: 'template-tag-codemod-route-template',
      visitor: {
        ElementNode(node) {
          if (node.path.type === 'PathExpression' && node.path.head.type === 'ThisHead') {
            node.path = builders.path([replacement, ...node.path.tail].join('.'));
            return node;
          }
        },
        PathExpression(node) {
          if (node.head.type === 'ThisHead') {
            return builders.path([replacement, ...node.tail].join('.'));
          }
        },
      },
    };
  };
  return transform;
}
