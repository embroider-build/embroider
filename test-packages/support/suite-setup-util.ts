import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { readdirSync, statSync } from 'fs-extra';
import execa from 'execa';

// we run our various Ember app's test suites in parallel, and unfortunately the
// shared persistent caching underneath various broccoli plugins is not
// parallel-safe. So we give each suite a separate TMPDIR to run within.
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

// this controls both what we will run locally when you do `yarn test` and also
// what jobs will get created in the GitHub actions matrix.
export async function allSuites() {
  let packageDirs = [...expandDirs('..'), ...expandDirs('../../packages')];
  let suites = [
    {
      name: 'node',
      command: 'yarn',
      args: ['test:node'],
      dir: resolve(__dirname, '..', '..'),
    },
  ];
  for (let dir of packageDirs) {
    let pkg = require(join(dir, 'package.json'));
    if (pkg.scripts) {
      for (let [name, command] of Object.entries(pkg.scripts as { [k: string]: string })) {
        let m = /^test:(.*)/.exec(name);
        if (m) {
          if (command === 'ember try:each') {
            // expand out all the ember-try scenarios as separate suites
            let scenarios = require(join(dir, 'config/ember-try.js'));
            for (let scenario of (await scenarios()).scenarios) {
              suites.push({
                name: `${pkg.name} ${scenario.name}`,
                command: 'yarn',
                args: ['ember', 'try:one', scenario.name, '--skip-cleanup'],
                dir,
              });
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

export async function githubMatrix() {
  let suites = await allSuites();
  return {
    name: suites.map(s => s.name),
    include: suites.map(s => ({
      name: s.name,
      command: `${s.command} ${s.args.join(' ')}`,
      dir: s.dir,
    })),
  };
}

export async function runAllSuites() {
  let suites = await allSuites();
  let succeeded = 0;
  let failed = 0;
  for (let suite of suites) {
    process.stdout.write(`SUITE START ${suite.name}\n`);
    try {
      let child = execa(suite.command, suite.args, {
        cwd: suite.dir,
        env: { TMPDIR: separateTemp() },
      });
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
      await child;
      process.stdout.write(`OK ${suite.name}\n`);
      succeeded++;
    } catch (err) {
      process.stdout.write(`FAIL ${suite.name}\n`);
      failed++;
    }
  }
  process.stdout.write(`${succeeded} succeeded, ${failed} failed, ${suites.length} total\n`);
  if (succeeded !== suites.length) {
    process.exit(-1);
  }
}

if (require.main === module) {
  if (process.argv.includes('--list')) {
    allSuites()
      .then(result => {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      })
      .catch(err => {
        process.stderr.write(err);
        process.exit(-1);
      });
  }

  if (process.argv.includes('--matrix')) {
    githubMatrix()
      .then(result => {
        process.stdout.write(JSON.stringify(result));
      })
      .catch(err => {
        process.stderr.write(err);
        process.exit(-1);
      });
  }

  if (process.argv.includes('--run-all')) {
    runAllSuites().catch(err => {
      console.log(err);
      process.exit(-1);
    });
  }
}

/*
  - test-packages/engines-host-app
      default vs CLASSIC
        each contains test:ember and test:fastboot

  - test-packages/fastboot-app
      default vs classic
        ember
        ember-production
        fastboot
        fastboot-production

  - test-packages/macro-sample-addon
      default vs classic
        has an ember try config that we don't run at the moment. we just run `ember test`

  - test-packages/macro-tests
      default vs classic

  - packages/router
      default vs classic
        has an ember try config that we don't run at the moment, we just run `ember test`

  - static-app
      default
      classic
      custom root url
      custom relative root url

  - packages/core
      jest
  - packages/compat
      jest
  - packages/macros
      jest

*/
