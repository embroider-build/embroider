const execa = require('execa');

test('node', async () => {
  jest.setTimeout(60000);

  await execa('yarn', ['node-test'], {
    cwd: `${__dirname}/..`,
    env: { JOBS: '1' },
  });
});
