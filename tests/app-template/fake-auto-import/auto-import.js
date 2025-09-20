const LeaderChooser = require('./leader').LeaderChooser;

module.exports = {
  AutoImport: class AutoImport {
    static register(addon) {
      LeaderChooser.for(addon).register(addon, () => new AutoImport(addon));
    }
    static lookup(addon) {
      return LeaderChooser.for(addon).leader;
    }
    registerV2Addon(packageName, packageRoot) {}
    included(addon) {}
  },
};
