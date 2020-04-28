const execa = require('execa');

test('router-with-engines-in-classical', async () => {
  jest.setTimeout(120000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/router-with-engines-in-classical`,
  });
});
