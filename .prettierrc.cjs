'use strict';

module.exports = {
  printWidth: 120,
  overrides: [
    {
      files: '*{js,ts}',
      options: {
        trailingComma: 'es5',
        arrowParens: 'avoid',
        singleQuote: true,
      },
    },
  ],
};
