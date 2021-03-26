import { tmpdir } from 'os';
import { basename, join, relative, resolve } from 'path';
import { readdirSync, statSync, unlinkSync, writeFileSync } from 'fs-extra';

// we sometimes run our various Ember app's test suites in parallel, and
// unfortunately the shared persistent caching underneath various broccoli
// plugins is not parallel-safe. So we give each suite a separate TMPDIR to run
// within.
export function separateTemp(name = `separate${Math.floor(Math.random() * 100000)}`): string {
  return join(tmpdir(), name);
}

export function testemConfig() {
  return {
    test_page: 'tests/index.html?hidepassed',
    disable_watching: true,
    launch_in_ci: ['Chrome'],
    launch_in_dev: ['Chrome'],
    browser_start_timeout: 90,
    browser_args: {
      Chrome: {
        ci: [
          // --no-sandbox is needed when running Chrome inside a container
          process.env.CI ? '--no-sandbox' : null,
          '--headless',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--mute-audio',
          '--remote-debugging-port=0',
          '--window-size=1440,900',
          `--crash-dumps-dir=${process.env.TMPDIR}`,
        ].filter(Boolean),
      },
    },
  };
}

function expandDirs(relativeToHere: string): string[] {
  let dir = resolve(__dirname, relativeToHere);
  return readdirSync(dir)
    .map(d => resolve(dir, d))
    .filter(d => statSync(d).isDirectory());
}

// these are all the separate test suites we want to run. As opposed to jest
// node tests, which run all together in a single jest run.
export async function allSuites({ includeEmberTry } = { includeEmberTry: true }) {
  let packageDirs = [...expandDirs('..'), ...expandDirs('../../packages')];
  let suites = [];
  for (let dir of packageDirs) {
    let pkg = require(join(dir, 'package.json'));
    if (pkg.scripts) {
      for (let [name, command] of Object.entries(pkg.scripts as { [k: string]: string })) {
        let m = /^test:(.*)/.exec(name);
        if (m) {
          if (command === 'ember try:each') {
            if (includeEmberTry) {
              // expand out all the ember-try scenarios as separate suites
              let scenarios = require(join(dir, 'config/ember-try.js'));
              for (let scenario of (await scenarios()).scenarios) {
                suites.push({
                  name: `${pkg.name} ${scenario.name}`,
                  command: 'yarn',
                  args: ['ember', 'try:one', scenario.name],
                  dir,
                });
              }
            }
          } else {
            suites.push({
              name: `${pkg.name} ${m[1]}`,
              command: 'yarn',
              args: [name],
              dir,
            });
          }
        }
      }
    }
  }
  return suites;
}

function relativeToEmbroiderRoot(absolutePath: string): string {
  let embroiderRoot = resolve(__dirname, '../..');

  return relative(embroiderRoot, absolutePath);
}

export async function githubMatrix() {
  let suites = await allSuites();

  // add the node tests, which we don't consider a "suite"
  suites.unshift({
    name: 'node',
    command: 'yarn',
    args: ['jest', '--forceExit'],
    dir: resolve(__dirname, '..', '..'),
  });

  let include = [
    // add our eslint
    {
      name: 'lint',
      os: 'ubuntu',
      command: 'yarn lint',
      dir: resolve(__dirname, '..', '..'),
    },
    ...suites.map(s => ({
      name: `${s.name} ubuntu`,
      os: 'ubuntu',
      command: `${s.command} ${s.args.join(' ')}`,
      dir: s.dir,
    })),
    ...suites.map(s => ({
      name: `${s.name} windows`,
      os: 'windows',
      command: `${s.command} ${s.args.join(' ')}`,
      dir: relativeToEmbroiderRoot(s.dir),
    })),
  ];

  return {
    name: include.map(s => s.name),
    include,
  };
}

export async function emitDynamicSuites() {
  let target = resolve(__dirname, 'dynamic_suites');
  for (let file of readdirSync(target)) {
    if (file !== '.gitkeep') {
      unlinkSync(resolve(target, file));
    }
  }

  // we don't emit the ember try scenarios here because they can't be
  // parallelized (they all mess with the monorepo-wide yarn state).
  let suites = await allSuites({ includeEmberTry: false });

  let jestSuites = new Map<string, typeof suites>();
  for (let suite of suites) {
    let assignedSuite = suite.name.replace(/^@[^/]+\//, '').replace(/[ /]/g, '_');
    let list = jestSuites.get(assignedSuite);
    if (!list) {
      list = [];
      jestSuites.set(assignedSuite, list);
    }
    list.push(suite);
  }

  for (let [dir, list] of jestSuites) {
    let tests = [`const execa = require('execa');`, `const { separateTemp } = require('../suite-setup-util');`];
    for (let suite of list) {
      tests.push(`
    test("${suite.name}", async function() {
      jest.setTimeout(300000);
      await execa("${suite.command}", ${JSON.stringify(suite.args)}, {
       cwd: "${suite.dir}",
       env: {
         TMPDIR: separateTemp()
       }
      });
    });
    `);
    }
    writeFileSync(join(target, `${basename(dir)}.test.js`), tests.join('\n'), 'utf8');
  }
}

async function main() {
  try {
    if (process.argv.includes('--list')) {
      const result = await allSuites();

      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }

    if (process.argv.includes('--matrix')) {
      const result = await githubMatrix();

      process.stdout.write(JSON.stringify(result));
    }

    if (process.argv.includes('--emit')) {
      await emitDynamicSuites();
    }
  } catch (error) {
    console.error(error);
    process.exitCode = -1;
  }
}

if (require.main === module) {
  main();
}
