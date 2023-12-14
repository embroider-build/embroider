import { viteAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { exec } from 'child_process';

const { module: Qmodule, test } = QUnit;

// cannot use util.promisify
// because then qunit will exit early with
// an error about an async hold
function execPromise(command: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

viteAppScenarios
  .map('vite-app-basics', _project => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`correct windows path`, async function (assert) {
        if (process.platform === 'win32') {
          // windows sometimes generates short path alias 8.3
          // which leads to resolving errors later
          // e.g. cannot find owning engine for C:\Users\runneradmin\AppData\Local\Temp\tmp-2256UvRXnGotcjxi\node_modules\.embroider\rewritten-app
          // the value in engines are:          C:\Users\RUNNER~1\AppData\Local\Temp\tmp-2256UvRXnGotcjxi\node_modules\.embroider\rewritten-app
          // it looks like there is no way to fix this in JS with
          // e.g fs.realpath, resolve, normalize
          // Powershell command can be used, python could also resolve it...
          const command = `powershell.exe -command "(Get-Item -LiteralPath '${app.dir}').FullName"`;
          const dir = await execPromise(command);
          app.dir = dir;
          assert.ok(!dir.includes('~'));
        }
        assert.ok(true);
      });

      test(`pnpm build:ember`, async function (assert) {
        let result = await app.execute('pnpm build:ember');
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test:ember`, async function (assert) {
        // this will only hang if there is an issue
        assert.timeout(5 * 60 * 1000);
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
        assert.ok(result.output.includes('should have Yay for gjs!'), 'should have tested gts test');
      });

      test(`pnpm build`, async function (assert) {
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
