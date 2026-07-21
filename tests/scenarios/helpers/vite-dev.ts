import { readFileSync, writeFileSync } from 'fs-extra';
import { resolve } from 'path';
import type { PreparedApp } from 'scenario-tester';
import CommandWatcher from './command-watcher';

export function setupViteDevServer(
  hooks: NestedHooks,
  getApp: () => PreparedApp,
  options: {
    viteArgs?: string[];
    rewriteProxy?: {
      testemFile?: string;
      base?: string;
    };
  } = {}
): {
  readonly appURL: string;
  readonly server: CommandWatcher;
} {
  let server: CommandWatcher;
  let appURL: string;

  hooks.before(async () => {
    let app = getApp();
    server = CommandWatcher.launch('vite', ['--clearScreen', 'false', ...(options.viteArgs ?? [])], { cwd: app.dir });
    [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

    let rewrite = options.rewriteProxy;
    if (rewrite) {
      let testemFile = rewrite.testemFile ?? 'testem-dev.cjs';
      let base = rewrite.base ?? '/';
      let url = appURL.replace(new RegExp(`^${base}`), '/').replace('//', '/');

      let testem = readFileSync(resolve(app.dir, testemFile)).toString();

      testem = testem.replace(`test_page: '/tests?hidepassed',`, `test_page: '${base}tests?hidepassed',`);
      testem = testem.replace(`.testemProxy('http://localhost:4200', '/')`, `.testemProxy('${url}', '${base}')`);

      writeFileSync(resolve(app.dir, testemFile), testem);

      let environment = readFileSync(resolve(app.dir, 'config', 'environment.js')).toString();
      environment = environment.replace(`rootURL: '/',`, `rootURL: '${base}',`);
      writeFileSync(resolve(app.dir, 'config', 'environment.js'), environment);
    }
  });

  hooks.after(async () => {
    await server?.shutdown();
  });

  return {
    get appURL() {
      return appURL;
    },
    get server() {
      return server;
    },
  };
}
