/* eslint-env node */
module.exports = function sampleTransform({ types }){
  return {
    visitor: {
      StringLiteral(path) {
        if (path.node.value === 'embroider-sample-transforms-target') {
          path.replaceWith(types.stringLiteral('embroider-sample-transforms-result'));
        }
      }
    }
  };
}
