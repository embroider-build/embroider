import cloneDeep from 'lodash/cloneDeep';
import { AddonMeta, PackageInfo } from '@embroider/core';
import resolve from 'resolve';
import { resolve as pathResolve } from 'path';
import { PluginItem } from '@babel/core';

export function addPeerDependency(packageJSON: PackageInfo, packageName: string, version = '*') {
  let pkg = cloneDeep(packageJSON);
  if (!pkg.peerDependencies) {
    pkg.peerDependencies = {};
  }
  pkg.peerDependencies[packageName] = version;
  return pkg;
}

export function forceIncludeModule(meta: Partial<AddonMeta>, localPath: string) {
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

// A babel plugin that removes reexports that point at nonexistent files.
// Unfortunately needed because some popular addons have bogus unused reexports.
//
// Append the output of this function to the `plugins` array in a babel config.
export function stripBadReexportsPlugin(opts: { filenamePattern?: RegExp; resolveBase?: string } = {}): PluginItem {
  return [stripBadReexportsTransform, { filenamePattern: opts.filenamePattern, resolveBase: opts.resolveBase }];
}

function stripBadReexportsTransform() {
  return {
    visitor: {
      ExportNamedDeclaration(path: any, state: any) {
        if (
          (!state.opts.filenamePattern || state.opts.filenamePattern.test(path.hub.file.opts.filename)) &&
          path.node.source &&
          path.node.source.type === 'StringLiteral'
        ) {
          try {
            resolve.sync(path.node.source.value, { basedir: state.opts.resolveBase });
          } catch (err) {
            path.remove();
          }
        }
      },
    },
  };
}
(stripBadReexportsTransform as any).baseDir = function () {
  return pathResolve(__dirname, '..');
};
