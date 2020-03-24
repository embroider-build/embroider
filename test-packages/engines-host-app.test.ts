import execa from 'execa';

test('engines-host-app', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/engines-host-app`,

    // TODO: once we have our engine support working, take this out so we run
    // the engine tests with embroider rather than classic.
    env: { CLASSIC: 'true' },
  });
});
