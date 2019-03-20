const execa = require('execa');

const TESTS = [
  ['node', 'node-test', { cwd: `${__dirname}/..`, env: { JOBS: '1' } }],
];

for (let [testName, command, options] of TESTS) {
  test(testName, async () => {
    jest.setTimeout(60000);
    await execa('yarn', [command], options);
  });
}

