import { viteAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';

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
