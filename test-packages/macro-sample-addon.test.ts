import execa from 'execa';

test('macro-addon', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-sample-addon`,
  });
});
