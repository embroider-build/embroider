/* eslint-env node */
function sampleTransform(env) {
  return {
    name: '@embroider/sample-transforms',

    visitor: {
      MustacheStatement(node) {
        if (node.path.type === 'PathExpression' && node.path.original === 'embroider-sample-transforms-target') {
          return env.syntax.builders.mustache(env.syntax.builders.path('embroider-sample-transforms-result'));
        }
      },
    },
  };
}

sampleTransform.parallelBabel = {
  requireFile: __filename,
  buildUsing: 'restore',
};

sampleTransform.restore = () => sampleTransform;

module.exports = sampleTransform;
