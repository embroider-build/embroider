const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('macro', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-tests`,
    env: {
      TMPDIR: separateTemp(),
    },
  });
});
