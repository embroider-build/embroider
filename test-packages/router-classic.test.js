const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('router-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/router`,
    env: { CLASSIC: 'true', TMPDIR: separateTemp() },
  });
});
