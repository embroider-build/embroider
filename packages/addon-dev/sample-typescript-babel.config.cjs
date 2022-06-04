'use strict';

const { resolve } = require;

module.exports = {
  presets: [resolve('@babel/preset-typescript')],
  plugins: [
    [
      resolve('@babel/plugin-transform-typescript'),
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
        // Default enums are IIFEs
        optimizeConstEnums: true,
      },
    ],
    [
      resolve('@babel/plugin-proposal-decorators'),
      {
        // The stage 1 implementation
        legacy: true,
      },
    ],
    resolve('@embroider/addon-dev/template-colocation-plugin'),
  ],
};
