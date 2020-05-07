const execa = require('execa');

test('engines-host-app embroider', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,
  });
});

test('engines-host-app classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,
    env: { CLASSIC: 'true' },
  });
});
