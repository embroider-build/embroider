const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('fastboot-app embroider', async () => {
  jest.setTimeout(480000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/fastboot-app`,
    env: {
      TMPDIR: separateTemp(),
    },
  });
});

test('fastboot-app classic', async () => {
  jest.setTimeout(480000);
  await execa('yarn', ['test'], {
    cwd: `${__dirname}/fastboot-app`,
    env: {
      CLASSIC: 'true',
      TMPDIR: separateTemp(),
    },
  });
});
