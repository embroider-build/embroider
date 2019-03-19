const execa = require('execa');

const TESTS = [
  ['node', 'node-test', { cwd: `${__dirname}/..`, env: { JOBS: '1' } }],
  ['macro-classic', 'test', { cwd: `${__dirname}/macro-tests`, env: { CLASSIC: 'true' } }],
  ['macro', 'test', { cwd: `${__dirname}/macro-tests` }],
  ['macro-addon', 'test', { cwd: `${__dirname}/macro-sample-addon` }],
  ['macro-addon-classic', 'test', { cwd: `${__dirname}/macro-sample-addon`, env: { CLASSIC: 'true' } }],
  ['static-app', 'test', { cwd: `${__dirname}/static-app` }],
  ['static-app-classic', 'test', { cwd: `${__dirname}/static-app`, env: { CLASSIC: 'true' } }],
];

for (let [testName, command, options] of TESTS) {
  test(testName, async () => {
    jest.setTimeout(60000);

    try {
      await execa('yarn', [command], options);
    } catch (error) {
      throw error;
    }
  });
}
