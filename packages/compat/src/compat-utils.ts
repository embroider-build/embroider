import cloneDeep from 'lodash/cloneDeep';
import { AddonMeta } from '@embroider/core';
import resolve from 'resolve';

export function addPeerDependency(packageJSON: any, packageName: string, version='*') {
  let pkg = cloneDeep(packageJSON);
  if (!pkg.peerDependencies) {
    pkg.peerDependencies = {};
  }
  pkg.peerDependencies[packageName] = version;
  return pkg;
}

export function forceIncludeModule(meta: AddonMeta, localPath: string) {
  meta = cloneDeep(meta);
  if (!meta.hasOwnProperty('implicit-modules')) {
    meta['implicit-modules'] = [];
  }
  meta['implicit-modules']!.push(localPath);
  return meta;
}

export function forceIncludeTestModule(meta: AddonMeta, localPath: string) {
  meta = cloneDeep(meta);
  if (!meta.hasOwnProperty('implicit-test-modules')) {
    meta['implicit-test-modules'] = [];
  }
  meta['implicit-test-modules']!.push(localPath);
  return meta;
}

// a babel plugin that removes reexports that point at nonexistent files.
// Unfortunately needed because some popular addons have bogus unused reexports.
export function addStripBadReexportsPlugin(pluginList: unknown[], filenamePattern: RegExp, resolveBase: string) {
  pluginList.push([stripBadReexportsTransform, { filenamePattern, resolveBase }]);
}

function stripBadReexportsTransform() {
  return {
    visitor: {
      ExportNamedDeclaration(path: any, state: any) {
        if (
          state.opts.filenamePattern.test(path.hub.file.opts.filename) &&
          path.node.source &&
          path.node.source.type === 'StringLiteral'
        ) {
          try {
            resolve.sync(path.node.source.value, { basedir: state.opts.resolveBase });
          } catch(err) {
            path.remove();
          }
        }
      }
    }
  };
}
