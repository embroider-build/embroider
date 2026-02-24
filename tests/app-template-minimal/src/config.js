import { setTesting } from '@embroider/macros';

const ENV = {
  modulePrefix: 'app-template-minimal',
  environment: import.meta.env.DEV ? 'development' : 'production',
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
