import { Scenarios, Project } from 'scenario-tester';
import { dirname, delimiter } from 'path';

// https://github.com/volta-cli/volta/issues/702
// We need this because we're launching node in child processes and we want
// those children to respect volta config per project.
(function restoreVoltaEnvironment() {
  let voltaHome = process.env['VOLTA_HOME'];
  if (!voltaHome) return;
  let paths = process.env['PATH']!.split(delimiter);
  while (/\.volta/.test(paths[0])) {
    paths.shift;
  }
  paths.unshift(`${voltaHome}/bin`);
  process.env['PATH'] = paths.join(delimiter);
})();

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
}

async function beta(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-beta' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
}

export function supportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    release,
    beta,
  });
}

export const appScenarios = supportMatrix(Scenarios.fromDir(dirname(require.resolve('../app-template/package.json'))));
