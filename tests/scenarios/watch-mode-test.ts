import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import globby from 'globby';
import fs from 'fs/promises';
import path from 'path';
import execa from 'execa';
const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('watch-mode', () => {
  /**
   * We will create files as a part of the watch-mode tests,
   * because creating files should cause appropriate watch/update behavior
   */
});

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let watchProcess: ReturnType<any>;
    let startedPromise: Promise<void>;
    let waitFor: (stdoutContent: string) => Promise<void>;

    async function checkScripts(distPattern: RegExp, needle: string) {
      let root = app.dir;
      let available = await globby('**/*', { cwd: path.join(root, 'dist') });

      let matchingFiles = available.filter((item: string) => distPattern.test(item));
      let matchingFileContents = await Promise.all(
        matchingFiles.map(async (item: string) => {
          return fs.readFile(path.join(app.dir, 'dist', item), 'utf8');
        })
      );
      return matchingFileContents.some((item: string) => item.includes(needle));
    }

    hooks.beforeEach(async () => {
      app = await scenario.prepare();
      watchProcess = execa('ember', ['s'], { cwd: app.dir });

      waitFor = (stdoutContent: string) => {
        return new Promise<void>(resolve => {
          watchProcess.stdout.on('data', (data: Buffer) => {
            let str = data.toString();
            if (str.includes(stdoutContent)) {
              resolve();
            }
          });
        });
      };

      startedPromise = waitFor('Serving on');
    });

    hooks.afterEach(async () => {
      watchProcess.cancel();
    });

    test(`pnpm ember test`, async function (assert) {
      await startedPromise;
      const content = 'TWO IS A GREAT NUMBER< I LKE IT A LOT< IT IS THE POWER OF ALL  OF ELECTRONICS, MATH, ETC';

      assert.false(await checkScripts(/js$/, content), 'file has not been created yet');

      fs.writeFile(path.join(app.dir, 'app/simple-file.js'), `export const two = "${content}";`);
      await waitFor('Build successful');

      assert.true(await checkScripts(/js$/, content), 'the file now exists');
    });
  });
});
