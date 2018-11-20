// All access to class ember-cli-provided Addon and EmberApp instances of v1
// packages is supposed to go through here. This lets us control the boundary
// between the new and old words.

import V1App from './v1-app';
import V1Addon, { V1AddonConstructor } from './v1-addon';
import { pathExistsSync } from 'fs-extra';
import { getOrCreate } from '@embroider/core';
import { MovablePackageCache } from './moved-package-cache';

export default class V1InstanceCache {
  static caches: WeakMap<object, V1InstanceCache> = new WeakMap();

  static forApp(emberApp: object): V1InstanceCache {
    return getOrCreate(this.caches, emberApp, () => new this(emberApp));
  }

  // maps from package root directories to known V1 instances of that packages.
  // There can be many because a single copy of an addon may be consumed by many
  // other packages and each gets an instance.
  private addons: Map<string, V1Addon[]> = new Map();
  private compatAdapters: Map<string, V1AddonConstructor> = new Map();

  app: V1App;
  packageCache = new MovablePackageCache();

  private constructor(oldApp: any) {
    if (!oldApp._activeAddonInclude) {
      throw new Error('@embroider/core requires a patch to ember-cli that provides tracking of who calls app.import');
    }

    this.app = new V1App(oldApp, this.packageCache);

    // no reason to do this on demand because oldApp already eagerly loaded
    // all descendants
    (oldApp.project.addons as any[]).forEach(addon => {
      this.addAddon(addon);
    });
  }

  registerCompatAdapter(packageName: string, constructor: V1AddonConstructor) {
    this.compatAdapters.set(packageName, constructor);
  }

  private adapterClass(packageName: string): V1AddonConstructor {
    // if the user registered something (including "null", which allows
    // disabling the built-in adapters), that takes precedence.
    if (this.compatAdapters.has(packageName)) {
      return this.compatAdapters.get(packageName) || V1Addon;
    }
    let path = `${__dirname}/compat-adapters/${packageName}.js`;
    if (pathExistsSync(path)) {
      return require(path).default;
    }
    return V1Addon;
  }

  private addAddon(addonInstance: any) {
    let Klass = this.adapterClass(addonInstance.pkg.name);
    let v1Addon = new Klass(addonInstance, this.packageCache);
    let pkgs = this.addons.get(v1Addon.root);
    if (!pkgs) {
      this.addons.set(v1Addon.root, pkgs = []);
    }
    pkgs.push(v1Addon);
    (addonInstance.addons as any[]).forEach(a => this.addAddon(a));
  }

  getAddons(root: string): V1Addon[] {
    return this.addons.get(root) || [];
  }
}
