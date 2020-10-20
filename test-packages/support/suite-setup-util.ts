import { tmpdir } from 'os';
import { join } from 'path';

let counter = 0;

// we run our various Ember app's test suites in parallel, and unfortunately the
// shared persistent caching underneath various broccoli plugins is not
// parallel-safe. So we give each suite a separate TMPDIR to run within.
export function separateTemp(name = `separate${counter++}`): string {
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
