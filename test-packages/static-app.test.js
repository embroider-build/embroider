const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('static-app', async () => {
  jest.setTimeout(240000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/static-app`,
    env: {
      TMPDIR: separateTemp(),
    },
  });
});
