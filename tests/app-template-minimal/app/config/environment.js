export default {
  modulePrefix: 'app-template-minimal',
  environment: import.meta.env.DEV ? 'development' : 'production',
  rootURL: '/',
  locationType: 'history',
  EmberENV: {
    EXTEND_PROTOTYPES: false,
    FEATURES: {
      // Here you can enable experimental features on an ember canary build
      // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
    },
  },

  ...(import.meta.env.MODE === 'test'
    ? {
        locationType: 'none',
      }
    : {}),
  APP: {
    // Here you can pass flags/options to your application instance
    // when it is created
    ...(import.meta.env.MODE === 'test'
      ? {
          // keep test console output quieter
          LOG_ACTIVE_GENERATION: false,
          LOG_VIEW_LOOKUPS: false,

          rootElement: '#ember-testing',
          autoboot: false,
        }
      : {}),
  },
};
