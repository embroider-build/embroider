import jsStringEscape from 'js-string-escape';

export function hbsToJS(hbsContents: string, moduleName?: string): string {
  let opts = '';
  if (moduleName) {
    opts = `,{ moduleName: "${jsStringEscape(moduleName)}" }`;
  }
  return [
    `import { precompileTemplate } from "@ember/template-compilation";`,
    `export default precompileTemplate("${jsStringEscape(hbsContents)}"${opts})`,
  ].join('\n');
}
