import { Scenarios, Project } from 'scenario-tester';
import { dirname } from 'path';
import pkgUp from 'pkg-up';

export async function lts_3_28(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-3.28' });
  // ember-cli 4.12 is the earliest version that can have an async function
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_4_4(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.4' });
  // ember-cli 4.12 is the earliest version that can have an async function
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_4_8(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.8' });
  // ember-cli 4.12 is the earliest version that can have an async function
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_4_12(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.12' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
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

async function lts_5_12(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-5.12' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-5.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-5.3' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_6_12(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-6.12' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-6.12' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('ember-cli-htmlbars', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars-7' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });

  project.mergeFiles({
    'tsconfig.json': JSON.stringify(
      {
        extends: '@tsconfig/ember/tsconfig.json',
        compilerOptions: {
          baseUrl: '.',
          skipLibCheck: true,
          // This line is the important part of this custom tsconfig.json
          types: ['ember-source/types'],
          paths: {
            'ts-app-template/tests/*': ['tests/*'],
            'ts-app-template/*': ['app/*'],
            '*': ['types/*'],
          },
        },
        include: ['app/**/*', 'tests/**/*', 'types/**/*'],
      },
      null,
      2
    ),
  });
}

export function patchTestWaiters(externalProject: Project) {
  // this overrides the @ember/test-waiters dependency of @ember/test-helper and @embroider/router to make sure it is @ember/test-waiters@4
  // both versions are in-range as a depedency, but for some reason scenario tester will always pick the lower one
  ['ember-test-helpers-5', '@embroider/router'].forEach(name => {
    let project = externalProject.dependencyProjects().find(p => p.name === name);

    if (!project) {
      project = Project.fromDir(dirname(pkgUp.sync({ cwd: require.resolve(`${name}`) })!), { linkDeps: true });
      externalProject.addDependency(project);
    }

    project.addDependency(
      Project.fromDir(dirname(pkgUp.sync({ cwd: require.resolve('@ember/test-waiters-4') })!), { linkDeps: true })
    );
  });
}

function updateEmberQunit(project: Project) {
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-9' });

  // The rewritten test-helper below uses the classic
  // `<modulePrefix>/config/environment` convention. A fully-v2 app
  // (`ember-addon.version === 2`) defines its config in `#config`/src and
  // ships its own correct test-helper (which calls `enterTestMode()`), so
  // clobbering it here is wrong for that case — leave it alone.
  if ((project.pkg as { 'ember-addon'?: { version?: number } })['ember-addon']?.version === 2) {
    return;
  }

  let testHelperFile = (project.files['tests'] as any)['test-helper.js'] ? 'test-helper.js' : 'test-helper.ts';

  (project.files['tests'] as any)[testHelperFile] = `
import Application from '${project.pkg.name}/app';
import config from '${project.pkg.name}/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

export function start() {
  setApplication(Application.create(config.APP));
  setup(QUnit.assert);
  // some test suites don't provide their own tests so we need to include at least one for CI to pass
  setupEmberOnerrorValidation();
  qunitStart();
}
`;
}

function checkLinkedVersion(project: Project, packageName: string): string | undefined {
  // @ts-expect-error we are reaching into private stuff here to check what version ember-qunit is
  const projectLinks = project.dependencyLinks.entries();
  const projectLinkArray: [string, { resolveName: string }][] = Array.from(projectLinks);
  const pkg = projectLinkArray.find(([name]) => name === packageName);
  return pkg?.[1].resolveName;
}

export function isUsingQunit9(project: Project): boolean {
  return checkLinkedVersion(project, 'ember-qunit') === 'ember-qunit-9';
}

export function isUsingEmberGte7(project: Project): boolean {
  const ember7ResolvedNames = ['ember-source-beta', 'ember-source-canary'];

  return ember7ResolvedNames.includes(checkLinkedVersion(project, 'ember-source')!);
}

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('ember-cli-htmlbars', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars-7' });
  project.linkDevDependency('@babel/core', { baseDir: __dirname });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
  project.linkDevDependency('ember-page-title', { baseDir: __dirname, resolveName: 'ember-page-title-9' });
  project.removeDevDependency('ember-cli-app-version');
  project.linkDevDependency('@glimmer/component', { baseDir: __dirname });

  updateEmberQunit(project);
  patchTestWaiters(project);

  project.mergeFiles({
    'tsconfig.json': JSON.stringify(
      {
        extends: '@tsconfig/ember/tsconfig.json',
        compilerOptions: {
          baseUrl: '.',
          skipLibCheck: true,
          // This line is the important part of this custom tsconfig.json
          types: ['ember-source/types'],
          paths: {
            'ts-app-template/tests/*': ['tests/*'],
            'ts-app-template/*': ['app/*'],
            '*': ['types/*'],
          },
        },
        include: ['app/**/*', 'tests/**/*', 'types/**/*'],
      },
      null,
      2
    ),
  });
}

async function beta(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-beta' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('ember-cli-htmlbars', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars-7' });
  project.linkDevDependency('@babel/core', { baseDir: __dirname });
  project.removeDevDependency('tracked-built-ins');
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: 'ember-test-helpers-5' });
  project.linkDevDependency('ember-page-title', { baseDir: __dirname, resolveName: 'ember-page-title-9' });
  project.removeDevDependency('ember-cli-app-version');
  project.linkDevDependency('@glimmer/component', { baseDir: __dirname });

  updateEmberQunit(project);
  patchTestWaiters(project);
}

async function canary(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-canary' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
  project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
  project.linkDevDependency('ember-cli-htmlbars', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars-7' });
  project.linkDevDependency('@tsconfig/ember', { baseDir: __dirname, resolveName: '@tsconfig/ember-3' });
  project.removeDevDependency('tracked-built-ins');
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: 'ember-test-helpers-5' });
  project.linkDevDependency('ember-page-title', { baseDir: __dirname, resolveName: 'ember-page-title-9' });
  project.removeDevDependency('ember-cli-app-version');
  project.linkDevDependency('@glimmer/component', { baseDir: __dirname });

  updateEmberQunit(project);
  patchTestWaiters(project);
}

export function supportMatrix(scenarios: Scenarios) {
  return (
    scenarios
      .expand({
        lts_3_28,
        lts_4_4,
        lts_5_12,
        lts_6_12,
        release,
        canary,
      })
      // we are skipping these scenarios for now and will likely add them back in one-by one once the
      // new vite based system is working as we like
      .skip('lts_3_28')
      .skip('lts_4_4')
  );
}

export function fullSupportMatrix(scenarios: Scenarios) {
  return scenarios.expand({
    lts_3_28,
    lts_4_4,
    lts_4_8,
    lts_4_12,
    lts_5_4,
    lts_5_8,
    lts_5_12,
    lts_6_12,
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

export function baseMinimalApp() {
  return Project.fromDir(dirname(require.resolve('../app-template-minimal/package.json')), { linkDevDeps: true });
}

export function baseTSAppClassic() {
  return Project.fromDir(dirname(require.resolve('../ts-app-template-classic/package.json')), { linkDevDeps: true });
}

export function baseViteApp() {
  return Project.fromDir(dirname(require.resolve('../vite-app/package.json')), { linkDevDeps: true });
}

export function baseWebpackApp() {
  return Project.fromDir(dirname(require.resolve('../app-template-webpack/package.json')), { linkDevDeps: true });
}

export function baseWebpackMinimalApp() {
  return Project.fromDir(dirname(require.resolve('../app-template-webpack-minimal/package.json')), {
    linkDevDeps: true,
  });
}

export const appScenarios = supportMatrix(Scenarios.fromProject(baseApp));

export const wideAppScenarios = fullSupportMatrix(Scenarios.fromProject(baseApp));

export const webpackAppScenarios = fullSupportMatrix(Scenarios.fromProject(baseWebpackApp));

// we're standardizing on Ember's native types, which become available starting
// at 4.8. So we're not going to run type tests on older releases that don't
// support them.
export const tsAppScenarios = supportMatrix(Scenarios.fromProject(baseTSApp)).skip('lts_3_28').skip('lts_4_4');

export const minimalAppScenarios = supportMatrix(Scenarios.fromProject(baseMinimalApp));

export const webpackMinimalAppScenarios = supportMatrix(Scenarios.fromProject(baseWebpackMinimalApp));

export const tsAppClassicScenarios = supportMatrix(Scenarios.fromProject(baseTSAppClassic))
  .skip('lts_3_28')
  .skip('lts_4_4');

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
