'use strict';
// Mirrors the vite minimal config (hbs() + ember()). @embroider/webpack has no
// standalone hbs() plugin and this strict-v2 app uses .gjs templates, so ember()
// alone is the analog. No classicEmberSupport(): this app has no @embroider/compat
// and no ember-cli-build.js, exactly like the vite minimal template.
const { ember } = require('@embroider/webpack');

module.exports = {
  plugins: [ember()],
};
