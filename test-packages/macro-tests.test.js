const execa = require('execa');

const TESTS = [
  ['macro-classic', 'test', { cwd: `${__dirname}/macro-tests`, env: { CLASSIC: 'true' } }],
  ['macro', 'test', { cwd: `${__dirname}/macro-tests` }],
];

for (let [testName, command, options] of TESTS) {
  test(testName, async () => {
    jest.setTimeout(60000);
    await execa('yarn', [command], options);
  });
}
