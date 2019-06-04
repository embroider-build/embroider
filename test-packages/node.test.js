const execa = require('execa');

test('node', async () => {
  jest.setTimeout(1200000);

  await execa('yarn', ['node-test'], {
    cwd: `${__dirname}/..`,
    env: { JOBS: '1' },
  });
});
