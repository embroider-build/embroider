import jsStringEscape from 'js-string-escape';

export function hbsToJS(hbsContents: string): string {
  return [`import { hbs } from 'ember-cli-htmlbars';`, `export default hbs("${jsStringEscape(hbsContents)}")`].join(
    '\n'
  );
}
