// All access to Addon and EmberApp instances of v1 packages is supposed to go
// through here. This lets us control the boundary between the new and old
// words.

import V1App from './v1-app';
import V1Addon from './v1-addon';

export default class V1InstanceCache {
  // maps from package root directories to known V1 instances of that packages.
  // There can be many because a single copy of an addon may be consumed by many
  // other packages and each gets an instance.
  private addons: Map<string, V1Addon[]> = new Map();

  constructor(private emberApp) {
    if (!emberApp._activeAddonInclude) {
      throw new Error('ember-cli-vanilla requires a patch to ember-cli that provides tracking of who calls app.import');
    }

    // no reason to do this on demand because emberApp already eagerly loaded
    // all descendants
    emberApp.project.addons.forEach(addon => {
      this.addAddon(addon);
    });
  }

  private addAddon(addonInstance) {
    let pkgs = this.addons.get(addonInstance.root);
    if (!pkgs) {
      this.addons.set(addonInstance.root, pkgs = []);
    }
    pkgs.push(new V1Addon(addonInstance));
    addonInstance.addons.forEach(a => this.addAddon(a));
  }

  getApp(root) {
    if (this.emberApp.project.root === root) {
      return new V1App(this.emberApp);
    }
  }
}
