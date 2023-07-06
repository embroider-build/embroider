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
      let rootDir = renaming.rootDir;
      if (filename.startsWith(rootDir)) {
        filename = renaming.modulePrefix + filename.slice(rootDir.length);
      }
      if (rootDir.endsWith('rewritten-app')) {
        rootDir = rootDir.replace(/rewritten-app$/, 'rewritten-packages');
        if (filename.startsWith(rootDir)) {
          filename = filename.slice(rootDir.length);
        }
      }
      if (filename.includes('node_modules')) {
        filename = filename.split('node_modules').slice(-1)[0];
      }
      if (sep !== '/') {
        filename = filename.replace(/\\/g, '/');
      }
      filename = filename.replace(/^\//, '');
    }
    optsSource = `,{ moduleName: "${jsStringEscape(filename)}" }`;
  }
  return [
    `import { precompileTemplate } from "@ember/template-compilation";`,
    `export default precompileTemplate("${jsStringEscape(hbsContents)}"${optsSource})`,
  ].join('\n');
}
