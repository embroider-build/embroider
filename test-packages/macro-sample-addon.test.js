const execa = require('execa');

test('macro-addon', async () => {
  jest.setTimeout(60000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-sample-addon`,
  });
});
