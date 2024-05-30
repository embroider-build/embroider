import loadConfigFromMeta from '@embroider/config-meta-loader';

let config = loadConfigFromMeta('dummy');
config.APP.fromConfigModule = 'hello new world';

export default config;
