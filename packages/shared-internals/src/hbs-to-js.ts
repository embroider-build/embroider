import jsStringEscape from 'js-string-escape';

export function hbsToJS(hbsContents: string, moduleName?: string): string {
  let opts = '';
  if (moduleName) {
    opts = `,{ moduleName: "${jsStringEscape(moduleName)}" }`;
  }
  return [
    `import { hbs } from 'ember-cli-htmlbars';`,
    `export default hbs("${jsStringEscape(hbsContents)}"${opts})`,
  ].join('\n');
}
