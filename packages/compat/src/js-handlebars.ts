// This is handlebars plus helpers specifically for generating Javascript.
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';

registerHelper('js-string-escape', jsStringEscape);

registerHelper('json-stringify', function(input: any) {
  return JSON.stringify(input);
});

export { compile };
