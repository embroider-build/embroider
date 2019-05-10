const execa = require('execa');

test('static-app-classic', async () => {
  jest.setTimeout(60000);

  await execa('ember', ['build'], {
    cwd: `${__dirname}/static-app`,
    env: { CUSTOM_ROOT_URL: '/custom/' },
  });
});
