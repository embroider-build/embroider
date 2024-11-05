'use strict';

const Filter = require('broccoli-persistent-filter');
const funnel = require('broccoli-funnel');
const { join } = require('path').posix;

class Awk extends Filter {
  constructor(inputNode, searchReplaceObj) {
    super(inputNode, {});
    this.searchReplaceObj = searchReplaceObj;
  }

  processString(content) {
    let modifiedContent = content;

    Object.entries(this.searchReplaceObj).forEach(([search, replace]) => {
      modifiedContent = modifiedContent.replace(search, replace);
    });

    return modifiedContent;
  }
}

module.exports = {
  name: require('./package').name,

  setupPreprocessorRegistry(type, registry) {
    registry.add('css', {
      name: this.name,
      ext: 'css',
      toTree: (tree, inputPath, outputPath) => {
        return funnel(new Awk(tree, { '%%%': inputPath === '/app/styles' ? 'red' : 'blue' }), {
          getDestinationPath(relativePath) {
            let relativePathWithPrefix = `/${relativePath}`;

            if (relativePathWithPrefix === `${inputPath}/app.css`) {
              return join(outputPath, '../@embroider/virtual/app.css');
            }

            return join(outputPath, relativePathWithPrefix.replace(inputPath, ''));
          },
        });
      },
    });
  },
};
