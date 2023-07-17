import V1Addon from '../v1-addon';

export default class extends V1Addon {
  get packageMeta() {
    let meta = super.packageMeta;
    // observer-manager is injected with the undocumented package@service syntax without being app re-exported
    // this makes sure that the service is always re-exported and injectable even when built with staticAddonTrees=true
    if (
      meta['implicit-modules'] &&
      !meta['implicit-modules'].find(implicitModule => implicitModule === './services/observer-manager.js')
    ) {
      meta['implicit-modules'].push('./services/observer-manager.js');
    } else if (!meta['implicit-modules']) {
      meta['implicit-modules'] = ['./services/observer-manager.js'];
    }
    return meta;
  }
}
