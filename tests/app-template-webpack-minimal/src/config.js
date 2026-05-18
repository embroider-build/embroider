import { setTesting, isDevelopingApp } from '@embroider/macros';

// `import.meta.env` is a Vite-only feature; the webpack minimal app uses
// @embroider/macros to decide the environment instead.
const ENV = {
  modulePrefix: 'app-template-webpack-minimal',
  environment: isDevelopingApp() ? 'development' : 'production',
  rootURL: '/',
  locationType: 'history',
  APP: {
    // Here you can pass flags/options to your application instance
    // when it is created
  },
};

export default ENV;

export function enterTestMode() {
  setTesting(true);

  ENV.locationType = 'none';
  ENV.APP.rootElement = '#ember-testing';
  ENV.APP.autoboot = false;
}
