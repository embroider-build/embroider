import { Scenarios, Project } from 'scenario-tester';
import { dirname } from 'path';

async function lts_3_16(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-3.16' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-3.16' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-3.16' });

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

async function lts_3_28(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data' });
}

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
}

export function supportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    lts_3_16,
    lts_3_24,
    lts_3_28,
    release,
  });
}

export function baseAddon(as: 'dummy-app' | 'dependency' = 'dependency') {
  return Project.fromDir(
    dirname(require.resolve('../addon-template/package.json')),
    as === 'dummy-app' ? { linkDevDeps: true } : { linkDeps: true }
  );
}

export function baseV2Addon() {
  return Project.fromDir(dirname(require.resolve('../v2-addon-template/package.json')), { linkDeps: true });
}

export function baseApp() {
  return Project.fromDir(dirname(require.resolve('../app-template/package.json')), { linkDevDeps: true });
}

export const appScenarios = supportMatrix(Scenarios.fromProject(baseApp));
export const dummyAppScenarios = supportMatrix(Scenarios.fromProject(() => baseAddon('dummy-app')));
