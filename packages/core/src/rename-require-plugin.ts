import type * as t from '@babel/types';
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
