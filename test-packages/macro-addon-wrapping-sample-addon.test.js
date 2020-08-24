const execa = require('execa');

test('macro-addon-wrapping-sample-addon embroider', async () => {
  jest.setTimeout(480000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-addon-wrapping-sample-addon`,
  });
});

test('macro-addon-wrapping-sample-addon classic', async () => {
  jest.setTimeout(480000);
  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-addon-wrapping-sample-addon`,
    env: { CLASSIC: 'true' },
  });
});
