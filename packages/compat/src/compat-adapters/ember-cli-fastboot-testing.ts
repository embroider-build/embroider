import V1Addon from '../v1-addon';

export default class EmberCliFastbootTesting extends V1Addon {
  get v2Tree() {
    let tree = super.v2Tree;
    let originalOutputReady = this.addonInstance.outputReady;
    let projectRoot = this.addonInstance.project.root;
    this.addonInstance.outputReady = function () {
      return originalOutputReady.call(this, {
        directory: `${projectRoot}/dist`,
      });
    };
    return tree;
  }
}
