// This is handlebars plus helpers specifically for generating Javascript.
import handlebars from 'handlebars';
import jsStringEscape from 'js-string-escape';

handlebars.registerHelper('js-string-escape', jsStringEscape);

handlebars.registerHelper('json-stringify', function (input: any, indent?: number) {
  return JSON.stringify(input, null, indent);
});

handlebars.registerHelper('eq', function (a: any, b: any) {
  return a === b;
});
export const compile = handlebars.compile;
