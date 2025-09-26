/* eslint-env node */
function sampleTransform(env) {
  return {
    name: 'embroider-sample-transforms',

    visitor: {
      MustacheStatement(node) {
        if (node.path.type === 'PathExpression' && node.path.original === 'embroider-sample-transforms-target') {
          return env.syntax.builders.mustache(env.syntax.builders.path('embroider-sample-transforms-result'));
        }
        if (node.path.type === 'PathExpression' && node.path.original === 'embroider-sample-transforms-module') {
          node.params.push({
            type: 'StringLiteral',
            value: env.moduleName,
            original: env.moduleName,
            loc: node.path.loc,
          });
          return node;
        }
      },
    },
  };
}

module.exports = sampleTransform;
