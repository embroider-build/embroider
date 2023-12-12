// eslint-disable-next-line n/no-missing-require
let config = require('./node_modules/.embroider/rewritten-app/_babel_config_');

let macrosPlugin = config.plugins.find(
  (p) => Array.isArray(p) && p[0].endsWith('macros-babel-plugin.js')
);
if (macrosPlugin?.[1].mode !== 'run-time') {
  throw new Error('expected to find macrosPlugin');
}

module.exports = config;
