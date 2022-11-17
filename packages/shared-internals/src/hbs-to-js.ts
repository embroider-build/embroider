import jsStringEscape from 'js-string-escape';
import { sep } from 'path';

export interface Options {
  filename?: string;

  // this is a backward-compatibility feature that allows us to show old AST
  // transforms the moduleName format they expect.
  compatModuleNaming?: {
    // the app root
    rootDir: string;
    // the app's module name
    modulePrefix: string;
  };
}

export function hbsToJS(hbsContents: string, options?: Options): string {
  let optsSource = '';
  if (options?.filename) {
    let filename = options.filename;
    let { compatModuleNaming: renaming } = options;
    if (renaming) {
      if (filename.startsWith(renaming.rootDir)) {
        filename = renaming.modulePrefix + filename.slice(renaming.rootDir.length);
      }
      if (sep !== '/') {
        filename = filename.replace(/\\/g, '/');
      }
    }
    optsSource = `,{ moduleName: "${jsStringEscape(filename)}" }`;
  }
  return [
    `import { precompileTemplate } from "@ember/template-compilation";`,
    `export default precompileTemplate("${jsStringEscape(hbsContents)}"${optsSource})`,
  ].join('\n');
}
