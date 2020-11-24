import { Portable } from './portable';

export default function babelLauncher(this: any, babel: any, launch: { module: any; arg: any }, babelPath: string) {
  let p = new Portable();
  let hydrated = p.hydrate(launch);
  let module;
  if (typeof hydrated.module === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require(hydrated.module);
    if (module.__esModule) {
      module = module.default;
    }
  } else {
    module = hydrated.module;
  }
  // our second argument ('launch') is the plugin options. But the real plugin
  // will also  want to look at these options, and they get passed directly from
  // babel to the various callbacks, without a change for us to intercept. So we
  // reuse our POJO.
  delete launch.module;
  delete launch.arg;
  Object.assign(launch, hydrated.arg);
  return module.call(this, babel, hydrated.arg, babelPath);
}
