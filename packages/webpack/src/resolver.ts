import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';
import { resolve } from 'path';
import { virtualContent, ResolverLoader } from '@embroider/core';

import { virtualFile } from './helpers';

export const virtualFiles: UnpluginFactory<{ resolverLoader: ResolverLoader }> = ({ resolverLoader }) => {
  return {
    name: 'embroider-resolver:virtual-files',
    ...virtualFile([
      {
        importPath: '@embroider/virtual/vendor.js',
        content: () =>
          virtualContent(
            resolve(resolverLoader.resolver.options.engines[0].root, '-embroider-vendor.js'),
            resolverLoader.resolver
          ).src,
      },
      {
        importPath: '@embroider/virtual/test-support.js',
        content: () =>
          virtualContent(
            resolve(resolverLoader.resolver.options.engines[0].root, '-embroider-test-support.js'),
            resolverLoader.resolver
          ).src,
      },
    ]),
  };
};

function combinedPlugins(/* user options */): UnpluginFactory<any>[] {
  const resolverLoader = new ResolverLoader(process.cwd());

  return [
    // @ts-expect-error are the types wwrong?
    virtualFiles({ resolverLoader }),
  ];
}

const resolverPlugin = /* #__PURE__ */ createUnplugin<undefined, true>(combinedPlugins);

export function resolver() {
  return resolverPlugin.webpack();
}
