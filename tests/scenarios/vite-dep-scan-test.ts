import { tsAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { existsSync, readdirSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

tsAppScenarios
  .only('lts_6_12')
  .expand({
    // Dependency scan via esbuild
    'vite-7.x': app => {
      app.linkDevDependency('vite', { resolveName: 'vite-7', baseDir: __dirname });
    },
    // Dependency scan via rolldown
    'vite-rolldown': app => {
      app.linkDevDependency('vite', { resolveName: 'vite-8', baseDir: __dirname });
    },
  })
  .map('vite-dep-scan', app => {
    app.mergeFiles({
      app: {
        components: {
          'multi-loose-example': {
            'targeted.gjs': `<template>hi</template>`,
            'first.hbs': `<MultiLooseExample::Targeted />`,
            'second.hbs': `<MultiLooseExample::Targeted />`,
          },
        },
      },
      tests: {
        integration: {
          'multi-loose-test.gjs': `
            import First from 'ts-app-template/components/multi-loose-example/first';
            import Second from 'ts-app-template/components/multi-loose-example/second';

            <template><First /><Second /></template>
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('dep scan sees which modules are really missing', async function (assert) {
        let result = await app.execute('pnpm vite optimize --force', {
          env: {
            EMBROIDER_VITE_COMMAND: 'build',
          },
        });

        assert.equal(result.exitCode, 0, result.output);

        let depsDir = join(app.dir, 'node_modules', '.vite', 'deps');
        let deps = existsSync(depsDir) ? readdirSync(depsDir) : [];

        assert.ok(
          deps.some(file => file.startsWith('ember-page-title')),
          `expected ember-page-title in optimized deps: ${deps.join(', ')}`
        );
      });
    });
  });
