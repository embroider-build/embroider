// This is handlebars plus helpers specifically for generating Javascript.
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';

registerHelper('js-string-escape', jsStringEscape);

registerHelper('json-stringify', function(input) {
  return JSON.stringify(input);
});

registerHelper('may-import-sync', function(specifier) {
  // todo: we can make this pluggable to optimize for final stage bundlers that have a better native option
  return `window.define("${jsStringEscape(specifier)}", function(){ return require("${jsStringEscape(specifier)}");});`;
});

export { compile };
