import type { Plugin } from 'vite';
import fs from 'fs-extra';
const { readJSONSync } = fs;
import { join } from 'path';
import * as core from '@embroider/core';
const { locateEmbroiderWorkingDir } = core;

export function contentFor(): Plugin {
  return {
    name: 'embroider-content-for',

    transformIndexHtml(html, { path }) {
      let config: any = readJSONSync(join(locateEmbroiderWorkingDir(process.cwd()), 'content-for.json'));
      let contentsForConfig = config[path];
      for (const [contentType, htmlContent] of Object.entries(contentsForConfig)) {
        html = html.replace(`{{content-for "${contentType}"}}`, `${htmlContent}`);
      }
      return html;
    },
  };
}
