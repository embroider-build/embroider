import { macroCondition, isTesting } from '@embroider/macros';

const ENV = {
  modulePrefix: 'ts-app-template',
  rootURL: '/',
  locationType: 'history',
  EmberENV: {
    EXTEND_PROTOTYPES: false,
    FEATURES: {
      // Here you can enable experimental features on an ember canary build
      // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
    },
  },

  APP: {
    // Here you can pass flags/options to your application instance
    // when it is created
  },
};

if (macroCondition(isTesting())) {
  // Testem prefers this...
  ENV.locationType = 'none';

  // keep test console output quieter
  ENV.APP.LOG_ACTIVE_GENERATION = false;
  ENV.APP.LOG_VIEW_LOOKUPS = false;

  ENV.APP.rootElement = '#ember-testing';
  ENV.APP.autoboot = false;
}

export default ENV;
