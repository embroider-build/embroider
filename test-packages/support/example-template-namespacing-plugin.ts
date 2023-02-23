import type { AST, ASTPluginEnvironment } from '@glimmer/syntax';

export default function emberHolyFuturisticNamespacingBatmanTransform(env: ASTPluginEnvironment) {
  let sigil = '$';
  let b = env.syntax.builders;

  function rewriteOrWrapComponentParam(node: AST.MustacheStatement | AST.SubExpression | AST.BlockStatement) {
    if (!node.params.length) {
      return;
    }

    let firstParam = node.params[0];
    if (firstParam.type !== 'StringLiteral') {
      // note: does not support dynamic / runtime strings
      return;
    }

    node.params[0] = b.string(firstParam.original.replace(sigil, '@'));
  }

  return {
    name: 'ember-holy-futuristic-template-namespacing-batman:namespacing-transform',

    visitor: {
      PathExpression(node: AST.PathExpression) {
        if (node.parts.length > 1 || !node.original.includes(sigil)) {
          return;
        }

        return b.path(node.original.replace(sigil, '@'), node.loc);
      },
      ElementNode(node: AST.ElementNode) {
        if (node.tag.indexOf(sigil) > -1) {
          node.tag = node.tag.replace(sigil, '@');
        }
      },
      MustacheStatement(node: AST.MustacheStatement) {
        if (node.path.type === 'PathExpression' && node.path.original === 'component') {
          // we don't care about non-component expressions
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
      SubExpression(node: AST.SubExpression) {
        if (node.path.type === 'PathExpression' && node.path.original !== 'component') {
          // we don't care about non-component expressions
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
      BlockStatement(node: AST.BlockStatement) {
        if (node.path.type === 'PathExpression' && node.path.original !== 'component') {
          // we don't care about blocks not using component
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
    },
  };
}
