const execa = require('execa');
const Fastboot = require('fastboot');

test('fastboot macro', async () => {
  jest.setTimeout(120000);
  const buildProcess = execa('ember', ['build'], {
    cwd: `${__dirname}/macro-tests`,
    env: { EMBROIDER: 'true' },
  });

  const promise = new Promise(res => {
    buildProcess.stdout.on('data', data => {
      const content = data.toString();
      if (content.includes('"dist/"')) {
        res(`${__dirname}/macro-tests/dist`);
      }
    });
  });

  const distPath = await promise;

  // Expect the error with mismatch mocule name.
  // Fastboot asset is importing `funky-sample-addon`
  // whereas `funky-sample-addon` module got changed to `@embroider/funky-sample-addon` in
  // chunked JS file.
  try {
    const fastboot = new Fastboot({
      distPath,
    });
    await fastboot.visit('/');
  } catch (e) {
    expect(e.message).toContain('Could not find module');
  }
});
