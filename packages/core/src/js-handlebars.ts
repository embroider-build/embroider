// This is handlebars plus helpers specifically for generating Javascript.
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';

registerHelper('js-string-escape', jsStringEscape);

registerHelper('json-stringify', function (input: any, indent?: number) {
  return JSON.stringify(input, null, indent);
});

registerHelper('eq', function (a: any, b: any) {
  return a === b;
});

export { compile };
