const execa = require('execa');

test('engines-host-app', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,
  });
});
