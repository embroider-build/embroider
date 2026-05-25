import fs from 'fs-extra';
const { readJSONSync, existsSync } = fs;
import { join } from 'path';
import { locateEmbroiderWorkingDir } from '@embroider/core';

// The webpack equivalent of vite's `embroider-content-for` plugin. The compat
// prebuild writes a content-for.json keyed by origin-absolute html path (e.g.
// "/index.html", "/tests/index.html"). Each value maps a content-for slot name
// to the html that ember-cli would have injected there classically.
export function applyContentFor(html: string, htmlPath: string, appRoot: string): string {
  let key = htmlPath.startsWith('/') ? htmlPath : '/' + htmlPath;
  let configPath = join(locateEmbroiderWorkingDir(appRoot), 'content-for.json');
  if (!existsSync(configPath)) {
    // a fully-v2 app using only ember() (no classicEmberSupport) won't have
    // run the compat prebuild, so there's nothing to substitute.
    return html;
  }
  let config: Record<string, Record<string, string>> = readJSONSync(configPath);
  let contentsForConfig = config[key];
  if (!contentsForConfig) {
    return html;
  }
  for (const [contentType, htmlContent] of Object.entries(contentsForConfig)) {
    html = html.replace(`{{content-for "${contentType}"}}`, `${htmlContent}`);
    html = html.replace(`{{content-for '${contentType}'}}`, `${htmlContent}`);
  }
  return html;
}
