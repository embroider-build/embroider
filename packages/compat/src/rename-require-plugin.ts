import type { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

export default function inlineHBSTransform(): unknown {
  return {
    visitor: {
      ImportDefaultSpecifier(path: NodePath<t.ImportDefaultSpecifier>) {
        if (path.node.local.name === 'require') {
          path.scope.rename('require');
        }
      },
    },
  };
}
