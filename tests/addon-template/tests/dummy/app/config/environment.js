// from https://github.com/ember-cli/ember-cli/blob/master/lib/broccoli/app-config-from-meta.js
export default (function() {
  let config = function() {
    let prefix = 'dummy';
    let metaName = prefix + '/config/environment';
    try {
      let rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
      let config = JSON.parse(decodeURIComponent(rawConfig));
      let exports = { 'default': config };
      Object.defineProperty(exports, '__esModule', { value: true });
      return exports;
		}
		catch(err) {
      throw new Error('Could not read config from meta tag with name "' + metaName + '".');
    }
  }()
  config.default.APP.fromConfigModule = 'hello new world';
  return config;
})().default;
