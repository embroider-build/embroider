import { viteAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { readdirSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

viteAppScenarios
  .map('vite-app-basics', _project => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
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
        console.log(result.output);
        assert.ok(result.output.includes('should have Yay for gjs!'), 'should have tested');
        const depCache = readdirSync(
          join(app.dir, 'node_modules', '.embroider', 'rewritten-app', 'node_modules', '.vite', 'deps')
        );
        assert.ok(depCache.length > 0, 'should have created cached deps');
      });
    });
  });
