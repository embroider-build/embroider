const execa = require('execa');

test('static-app-classic', async () => {
  jest.setTimeout(60000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/static-app`,
    env: { CLASSIC: 'true' },
  });
});
