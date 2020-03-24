import execa from 'execa';

test('router', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/router`,
  });
});
