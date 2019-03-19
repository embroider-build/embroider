const execa = require('execa');

const TESTS = [
  ['macro-addon', 'test', { cwd: `${__dirname}/macro-sample-addon` }],
  ['macro-addon-classic', 'test', { cwd: `${__dirname}/macro-sample-addon`, env: { CLASSIC: 'true' } }],
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
