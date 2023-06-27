import { baseApp } from './scenarios';

import { type PreparedApp, Scenarios, type Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { loadFromFixtureData } from './helpers';

const { module: Qmodule, test } = QUnit;

function emberDataVersion(version: string) {
  return function (project: Project) {
    project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: `ember-data-${version}` });
  };
}

export function allEmberDatas(scenarios: Scenarios) {
  const expansions = {
    'ember-data-3.28': (project: Project) => project,
  } as Record<string, any>;

  ['4.0', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12'].forEach(version => {
    expansions[`ember-data-${version}`] = emberDataVersion(version);
  });

  return scenarios.expand(expansions);
}

export const emberDataScenarios = allEmberDatas(Scenarios.fromProject(baseApp));

let engineScenarios = emberDataScenarios.map('all-ember-data-versions', project => {
  merge(project.files, loadFromFixtureData('ember-data-app'));
});

engineScenarios.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    hooks.before(async () => {
      app = await scenario.prepare();
    });

    test(`pnpm test`, async function (assert) {
      let result = await app.execute('pnpm test');
      assert.equal(result.exitCode, 0, result.output);
    });
  });
});
