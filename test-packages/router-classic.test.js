const execa = require('execa');

test('router-classic', async () => {
  jest.setTimeout(60000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/router`,
    env: { CLASSIC: 'true' },
  });
});
