// This is handlebars plus helpers specifically for generating Javascript.
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';

registerHelper('js-string-escape', jsStringEscape);

registerHelper('may-import-sync', function(specifier) {
  // todo: this will be pluggable based on which final-stage packager you're
  // using. It is one of the few things that must be provided.
  return `require.include("${jsStringEscape(specifier)}");`;
});

export { compile };
