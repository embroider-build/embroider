console.log(process.version);

var babel = require("@babel/core");

const { join } = require('path');

const { MacrosConfig } = require('./src/node');

let config = MacrosConfig.for({}, __dirname);

let response = babel.transform(`
import { macroCondition } from '@embroider/macros';
export default function() {
  if (macroCondition(true)) {
    return 'alpha';
  } else {
    return 'beta';
  }
}
`, {
  filename: join(__dirname, 'sample.js'),
  configFile: false,
  plugins: config.babelPluginConfig(),
});


if(response.code.trim() !== `export default function () {
  {
    return 'alpha';
  }
}`.trim()) {
  console.error(response.code);
  throw new Error("smoke test failed");
}
