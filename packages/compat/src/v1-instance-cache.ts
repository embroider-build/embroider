// All access to class ember-cli-provided Addon and EmberApp instances of v1
// packages is supposed to go through here. This lets us control the boundary
// between the new and old words.

import V1Addon, { V1AddonConstructor } from './v1-addon';
import { pathExistsSync } from 'fs-extra';
import { AddonInstance, getOrCreate, PackageCache } from '@embroider/core';
import CompatApp from './compat-app';

export default class V1InstanceCache {
  // maps from package root directories to known V1 instances of that packages.
  // There can be many because a single copy of an addon may be consumed by many
  // other packages and each gets an instance.
  private addons: Map<string, V1Addon[]> = new Map();
  private orderIdx: number;

  constructor(private app: CompatApp, private packageCache: PackageCache) {
    this.app = app;
    this.orderIdx = 0;

    // no reason to do this on demand because the legacy ember app instance
    // already loaded all descendants
    (app.legacyEmberAppInstance.project.addons as AddonInstance[]).forEach(addon => {
      this.addAddon(addon);
    });
  }

  private adapterClass(addonInstance: AddonInstance): V1AddonConstructor {
    let packageName = addonInstance.pkg.name;
    // if the user registered something (including "null", which allows
    // disabling the built-in adapters), that takes precedence.
    let AdapterClass = this.app.options.compatAdapters.get(packageName);

    if (AdapterClass === null) {
      return V1Addon;
    }

    if (!AdapterClass) {
      let path = `${__dirname}/compat-adapters/${packageName}.js`;
      if (pathExistsSync(path)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        AdapterClass = require(path).default;
      }
    }

    if (!AdapterClass) {
      return V1Addon;
    }

    if (AdapterClass.shouldApplyAdapter) {
      return AdapterClass.shouldApplyAdapter(addonInstance) ? AdapterClass : V1Addon;
    }

    return AdapterClass;
  }

  private addAddon(addonInstance: AddonInstance) {
    // Traverse and add any nested addons. This must happen _before_ we add
    // the addon itself to correctly preserve the addon ordering.
    addonInstance.addons.forEach(a => this.addAddon(a));

    this.orderIdx += 1;
    let Klass = this.adapterClass(addonInstance);
    let v1Addon = new Klass(addonInstance, this.app.options, this.app, this.packageCache, this.orderIdx);
    let pkgs = getOrCreate(this.addons, v1Addon.root, () => []);
    pkgs.push(v1Addon);
  }

  getAddons(root: string): V1Addon[] {
    return this.addons.get(root) || [];
  }
}
