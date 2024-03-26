import { Project, Scenario, Scenarios } from 'scenario-tester';
import { dirname } from 'path';
import { exec } from 'child_process';

let prepare = Scenario.prototype.prepare;
Scenario.prototype.prepare = async function (...args) {
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
  let app = await prepare.call(this, ...args);
  if (process.platform === 'win32') {
    const command = `powershell.exe -command "(Get-Item -LiteralPath '${app.dir}').FullName"`;
    app.dir = await execPromise(command);
  }
  console.log(app.dir);
  return app;
};

export async function lts_3_28(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
}

async function lts_4_4(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-4.4' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-4.4' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
}

async function release(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-latest' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-7' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

async function lts_5_8(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-5.8' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-latest' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-7' });
}

async function canary(project: Project) {
  project.linkDevDependency('ember-source', { baseDir: __dirname, resolveName: 'ember-source-canary' });
  project.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: 'ember-cli-beta' });
  project.linkDevDependency('ember-data', { baseDir: __dirname, resolveName: 'ember-data-latest' });
  project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: '@ember/test-helpers-3' });
  project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-7' });
  project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters' });
}

export function supportMatrix(scenarios: Scenarios) {
  return (
    scenarios
      .expand({
        lts_3_28,
        lts_4_4,
        lts_5_8,
        release,
        canary,
      })
      // we are skipping these scenarios for now and will likely add them back in one-by one once the
      // new vite based system is working as we like
      .skip('lts_3_28')
      .skip('lts_4_4')
      .skip('release')
  );
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

export function baseTSAppClassic() {
  return Project.fromDir(dirname(require.resolve('../ts-app-template-classic/package.json')), { linkDevDeps: true });
}

export function baseViteApp() {
  return Project.fromDir(dirname(require.resolve('../vite-app/package.json')), { linkDevDeps: true });
}

export const appScenarios = supportMatrix(Scenarios.fromProject(baseApp));

// we're standardizing on Ember's native types, which become available starting
// at 4.8. So we're not going to run type tests on older releases that don't
// support them.
export const tsAppScenarios = supportMatrix(Scenarios.fromProject(baseTSApp)).skip('lts_3_28').skip('lts_4_4');

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
