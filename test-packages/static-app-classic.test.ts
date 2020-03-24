import execa from 'execa';

test('static-app-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/static-app`,
    env: { CLASSIC: 'true' },
  });
});
