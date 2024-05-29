// from https://github.com/ember-cli/ember-cli/blob/master/lib/broccoli/app-config-from-meta.js
export default function loadConfigFromMeta(prefix: string): any {
  let metaName = `${prefix}/config/environment`;
  try {
    let rawConfig = document.querySelector(`meta[name="${metaName}"]`)!.getAttribute('content') ?? '{}';
    let config = JSON.parse(decodeURIComponent(rawConfig));
    return config;
  } catch (err) {
    return `Could not read config from meta tag with name "${metaName}".`;
  }
}
