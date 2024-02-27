import type { Plugin } from 'vite';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import { locateEmbroiderWorkingDir } from '@embroider/core';

export function contentFor(): Plugin {
  return {
    name: 'embroider-content-for',

    transformIndexHtml(html) {
      let config: any = readJSONSync(join(locateEmbroiderWorkingDir(process.cwd()), 'content-for.json'));
      for (const [contentType, htmlContent] of Object.entries(config)) {
        html = html.replace(`{{content-for "${contentType}"}}`, `${htmlContent}`);
      }
      return html;
    },
  };
}
