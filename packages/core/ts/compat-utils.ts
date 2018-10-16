import cloneDeep from 'lodash/cloneDeep';

export function addPeerDependency(packageJSON, packageName, version='*') {
  let pkg = cloneDeep(packageJSON);
  if (!pkg.peerDependencies) {
    pkg.peerDependencies = {};
  }
  pkg.peerDependencies[packageName] = version;
  return pkg;
}

export function forceIncludeModule(meta, localPath) {
  meta = cloneDeep(meta);
  if (!meta['implicit-modules']) {
    meta['implicit-modules'] = [];
  }
  meta['implicit-modules'].push(localPath);
  return meta;
}
