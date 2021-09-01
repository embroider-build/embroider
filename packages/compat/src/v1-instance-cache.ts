// All access to class ember-cli-provided Addon and EmberApp instances of v1
// packages is supposed to go through here. This lets us control the boundary
// between the new and old words.

import V1App from './v1-app';
import V1Addon, { V1AddonConstructor } from './v1-addon';
import { pathExistsSync } from 'fs-extra';
import { AddonInstance, getOrCreate } from '@embroider/core';
import { MovablePackageCache } from './moved-package-cache';
import Options from './options';
import isEqual from 'lodash/isEqual';
import { MacrosConfig } from '@embroider/macros/src/node';

export default class V1InstanceCache {
  static caches: WeakMap<object, V1InstanceCache> = new WeakMap();

  static forApp(emberApp: object, options: Required<Options>): V1InstanceCache {
    let instance = getOrCreate(this.caches, emberApp, () => new this(emberApp, options));
    if (!isEqual(instance.options, options)) {
      throw new Error(`attempted double set of app Options`);
    }
    return instance;
  }

  // maps from package root directories to known V1 instances of that packages.
  // There can be many because a single copy of an addon may be consumed by many
  // other packages and each gets an instance.
  private addons: Map<string, V1Addon[]> = new Map();

  app: V1App;
  packageCache: MovablePackageCache;
  orderIdx: number;

  private constructor(oldApp: any, private options: Required<Options>) {
    this.packageCache = new MovablePackageCache(MacrosConfig.for(oldApp));
    this.app = V1App.create(oldApp, this.packageCache);
    this.orderIdx = 0;

    // no reason to do this on demand because oldApp already eagerly loaded
    // all descendants
    (oldApp.project.addons as AddonInstance[]).forEach(addon => {
      this.addAddon(addon);
    });
  }

  private adapterClass(addonInstance: AddonInstance): V1AddonConstructor {
    let packageName = addonInstance.pkg.name;
    // if the user registered something (including "null", which allows
    // disabling the built-in adapters), that takes precedence.
    let AdapterClass = this.options.compatAdapters.get(packageName);

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
    this.orderIdx += 1;
    let Klass = this.adapterClass(addonInstance);
    let v1Addon = new Klass(addonInstance, this.options, this.app, this.packageCache, this.orderIdx);
    let pkgs = getOrCreate(this.addons, v1Addon.root, () => []);
    pkgs.push(v1Addon);
    addonInstance.addons.forEach(a => this.addAddon(a));
  }

  getAddons(root: string): V1Addon[] {
    return this.addons.get(root) || [];
  }
}
