const execa = require('execa');
const { tmpdir } = require('os');
const { join } = require('path');

test('static-app-classic', async () => {
  jest.setTimeout(120000);

  await execa('ember', ['build'], {
    cwd: `${__dirname}/static-app`,
    env: {
      CUSTOM_ROOT_URL: '/custom/',
      WORKSPACE_DIR: join(tmpdir(), 'embroider', 'static-app-rooturl'),
    },
  });
});

test('static-app-classic with relative rootUrl', async () => {
  jest.setTimeout(120000);

  await execa('ember', ['build'], {
    cwd: `${__dirname}/static-app`,
    env: {
      CUSTOM_ROOT_URL: 'custom-relative-root-url/',
      WORKSPACE_DIR: join(tmpdir(), 'embroider', 'static-app-rooturl'),
    },
  });
});
