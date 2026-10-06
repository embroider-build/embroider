import EmberApp from 'ember-cli/lib/broccoli/ember-app';
import { compatBuild } from '@embroider/compat';
import { buildOnce } from '@embroider/vite';

export default function (defaults) {
  let app = new EmberApp(defaults);

  return compatBuild(app, buildOnce, {
    useAddonConfigModule: false,
    useAddonAppBoot: false,
  });
}
