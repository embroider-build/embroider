import loadConfigFromMeta from '@embroider/config-meta-loader';

let config;

if (typeof FastBoot !== 'undefined') {
  config = FastBoot.config('app-template');
} else {
  config = loadConfigFromMeta('app-template');
}

export default config;
