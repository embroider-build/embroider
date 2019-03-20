const execa = require('execa');

const TESTS = [
  ['static-app', 'test', { cwd: `${__dirname}/static-app` }],
  ['static-app-classic', 'test', { cwd: `${__dirname}/static-app`, env: { CLASSIC: 'true' } }],
];

for (let [testName, command, options] of TESTS) {
  test(testName, async () => {
    jest.setTimeout(60000);
    await execa('yarn', [command], options);
  });
}
