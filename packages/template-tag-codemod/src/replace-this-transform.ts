import type { ASTPluginBuilder } from '@glimmer/syntax';

export function replaceThisTransform(replacement: string, result: { didReplace: boolean }): ASTPluginBuilder {
  const transform: ASTPluginBuilder = ({ syntax: { builders } }) => {
    return {
      name: 'template-tag-codemod-route-template',
      visitor: {
        PathExpression(node) {
          if (node.head.type === 'ThisHead') {
            result.didReplace = true;
            return builders.path(`${replacement}.${node.tail.join('.')}`);
          }
        },
      },
    };
  };
  return transform;
}
