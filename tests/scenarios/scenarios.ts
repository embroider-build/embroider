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
    paths.shift();
  }
  paths.unshift(`${voltaHome}/bin`);
  process.env['PATH'] = paths.join(delimiter);
})();

async function lts_3_16(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-3.16' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-3.16' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-3.16' });

  // needed because the ember-inflector used by this ember-data version blows up without it
  project.linkDevDependency('@ember/string', { baseDir: __dirname });
}

async function lts_3_20(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-3.20' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-3.20' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-3.20' });

  // needed because the ember-inflector used by this ember-data version blows up without it
  project.linkDevDependency('@ember/string', { baseDir: __dirname });
}

async function lts_3_24(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-3.24' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-3.24' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-3.24' });

  // needed because the ember-inflector used by this ember-data version blows up without it
  project.linkDevDependency('@ember/string', { baseDir: __dirname });
}

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
}

export function supportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    lts_3_16,
    lts_3_20,
    lts_3_24,
    release,
  });
}

export const appScenarios = supportMatrix(Scenarios.fromDir(dirname(require.resolve('../app-template/package.json'))));
