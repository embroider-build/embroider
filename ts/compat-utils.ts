import cloneDeep from 'lodash/cloneDeep';

export function addPeerDependency(packageJSON, packageName, version='*') {
  let pkg = cloneDeep(packageJSON);
  if (!pkg.peerDependencies) {
    pkg.peerDependencies = {};
  }
  pkg.peerDependencies[packageName] = version;
  return pkg;
}
