const execa = require('execa');

test('fastboot-app embroider', async () => {
  jest.setTimeout(480000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/fastboot-app`,
  });
});

test('fastboot-app classic', async () => {
  jest.setTimeout(480000);
  await execa('yarn', ['test'], {
    cwd: `${__dirname}/fastboot-app`,
    env: { CLASSIC: 'true' },
  });
});
