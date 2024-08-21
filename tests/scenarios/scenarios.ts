import { Scenarios, Project } from 'scenario-tester';
import { dirname } from 'path';

async function lts_3_28(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data' });
}

async function lts_4_4(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.4' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.4' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-4.4' });
}

async function lts_4_8(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.8' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.8' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-4.8' });
}

async function lts_4_12(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.12' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-4.12' });
}

async function lts_5_4(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-5.4' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-5.4' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_5_8(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-5.8' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-5.8' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('@babel/core', { baseDir: __dirname });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-8' });
  project.linkDevDependency('ember-resolver', { baseDir: __dirname, resolveName: 'ember-resolver-12' });
  project.linkDevDependency('@ember/string', { baseDir: __dirname, resolveName: '@ember/string-4' });
  project.linkDevDependency('ember-cli-app-version', { baseDir: __dirname, resolveName: 'ember-cli-app-version-7' });
}

async function beta(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-beta' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('@babel/core', { baseDir: __dirname });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-8' });
  project.linkDevDependency('ember-resolver', { baseDir: __dirname, resolveName: 'ember-resolver-12' });
  project.linkDevDependency('@ember/string', { baseDir: __dirname, resolveName: '@ember/string-4' });
  project.linkDevDependency('ember-cli-app-version', { baseDir: __dirname, resolveName: 'ember-cli-app-version-7' });
}

async function canary(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-canary' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-8' });
  project.linkDevDependency('ember-resolver', { baseDir: __dirname, resolveName: 'ember-resolver-12' });
  project.linkDevDependency('@ember/string', { baseDir: __dirname, resolveName: '@ember/string-4' });
  project.linkDevDependency('ember-cli-app-version', { baseDir: __dirname, resolveName: 'ember-cli-app-version-7' });
}

export function supportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    lts_3_28,
    lts_4_4,
    release,
  });
}

export function fullSupportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    lts_3_28,
    lts_4_4,
    lts_4_8,
    lts_4_12,
    lts_5_4,
    lts_5_8,
    release,
    beta,
    canary,
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

export function baseTSApp() {
  return Project.fromDir(dirname(require.resolve('../ts-app-template/package.json')), { linkDevDeps: true });
}

export const appScenarios = supportMatrix(Scenarios.fromProject(baseApp));

export const wideAppScenarios = fullSupportMatrix(Scenarios.fromProject(baseApp));

// we're standardizing on Ember's native types, which become available starting
// at 4.8. So we're not going to run type tests on older releases that don't
// support them.
export const tsAppScenarios = supportMatrix(Scenarios.fromProject(baseTSApp)).skip('lts_3_28').skip('lts_4_4');

export const dummyAppScenarios = supportMatrix(Scenarios.fromProject(() => baseAddon('dummy-app')));

// renames a v1 app
export function renameApp(project: Project, newName: string) {
  let oldName = project.pkg.name;
  let target = new RegExp('\\b' + oldName + '\\b', 'g');
  function rename(files: Project['files']) {
    for (let [path, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        files[path] = content.replace(target, newName);
      } else if (content) {
        rename(content);
      }
    }
  }
  rename(project.files);
  project.pkg.name = newName;
}
