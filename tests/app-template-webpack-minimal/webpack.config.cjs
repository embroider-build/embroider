'use strict';
// This is a fully-v2 ("minimal") app, so it only needs ember() — no
// classicEmberSupport()/compat prebuild — exactly like the vite minimal app's
// vite.config.mjs uses `hbs()` + `ember()`.
const { ember } = require('@embroider/webpack');

module.exports = {
  plugins: [ember()],
};
