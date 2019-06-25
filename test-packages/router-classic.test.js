const execa = require('execa');

test('router-classic', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/router`,
    env: { CLASSIC: 'true' },
  });
});
