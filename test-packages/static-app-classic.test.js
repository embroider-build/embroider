const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('static-app-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/static-app`,
    env: { CLASSIC: 'true', TMPDIR: separateTemp() },
  });
});
