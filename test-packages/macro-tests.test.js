const execa = require('execa');

test('macro', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-tests`,
  });
});
