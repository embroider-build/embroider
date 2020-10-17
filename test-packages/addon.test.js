const execa = require('execa');

test('macro', async () => {
  // this runs the entire ember-try matrix, so a long timeout is appropriate
  jest.setTimeout(600000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/../packages/addon`,
  });
});
