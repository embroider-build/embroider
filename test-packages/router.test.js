const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('router', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/router`,
    env: {
      TMPDIR: separateTemp(),
    },
  });
});
