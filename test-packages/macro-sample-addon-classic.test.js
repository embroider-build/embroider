const execa = require('execa');
const { separateTemp } = require('./support/suite-setup-util');

test('macro-addon-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-sample-addon`,
    env: {
      CLASSIC: 'true',
      TMPDIR: separateTemp(),
    },
  });
});
