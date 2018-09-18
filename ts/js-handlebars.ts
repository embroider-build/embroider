// This is handlebars plus helpers specifically for generating Javascript.
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';

registerHelper('js-string-escape', jsStringEscape);

registerHelper('json-stringify', function(input) {
  return JSON.stringify(input);
});

registerHelper('may-import-sync', function({ runtime, buildtime }) {
  // todo: we can make this pluggable to optimize for final stage bundlers that have a better native option
  return `window.define("${jsStringEscape(runtime)}", function(){ return require("${jsStringEscape(buildtime)}");});`;
});

export { compile };
