import cloneDeep from 'lodash/cloneDeep';
import { AddonPackageJSON } from '@embroider/core';

export function addPeerDependency(packageJSON: any, packageName: string, version='*') {
  let pkg = cloneDeep(packageJSON);
  if (!pkg.peerDependencies) {
    pkg.peerDependencies = {};
  }
  pkg.peerDependencies[packageName] = version;
  return pkg;
}

export function forceIncludeModule(meta: AddonPackageJSON["ember-addon"], localPath: string) {
  meta = cloneDeep(meta);
  if (!meta.hasOwnProperty('implicit-modules')) {
    meta['implicit-modules'] = [];
  }
  meta['implicit-modules']!.push(localPath);
  return meta;
}
