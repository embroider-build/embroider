'use strict';
const { classicEmberSupport, ember } = require('@embroider/webpack');

module.exports = {
  plugins: [classicEmberSupport(), ember()],
};
