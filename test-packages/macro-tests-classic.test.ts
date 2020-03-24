import execa from 'execa';

test('macro-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/macro-tests`,
    env: { CLASSIC: 'true' },
  });
});
