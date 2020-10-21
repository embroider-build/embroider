const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('engines-host-app embroider', async () => {
  jest.setTimeout(240000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,
    env: {
      TMPDIR: separateTemp(),
    },
  });
});

test('engines-host-app classic', async () => {
  jest.setTimeout(240000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,
    env: {
      CLASSIC: 'true',
      TMPDIR: separateTemp(),
    },
  });
});
