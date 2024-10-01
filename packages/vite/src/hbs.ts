import { createFilter } from '@rollup/pluginutils';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import {
  hbsToJS,
  ResolverLoader,
  needsSyntheticComponentJS,
  isInComponents,
  templateOnlyComponentSource,
  syntheticJStoHBS,
} from '@embroider/core';

const resolverLoader = new ResolverLoader(process.cwd());
const hbsFilter = createFilter('**/*.hbs?([?]*)');

export function hbs(): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    enforce: 'pre',
    async resolveId(source: string, importer: string | undefined, options) {
      if (options.custom?.depScan) {
        // during depscan we have a corresponding esbuild plugin that is
        // responsible for this stuff instead. We don't want to fight with it.
        return null;
      }

      if (options.custom?.embroider?.isExtensionSearch) {
        return null;
      }

      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
      });

      if (!resolution) {
        let hbsSource = syntheticJStoHBS(source);
        if (hbsSource) {
          resolution = await this.resolve(hbsSource, importer, {
            skipSelf: true,
            custom: {
              embroider: {
                // we don't want to recurse into the whole embroider compatbility
                // resolver here. It has presumably already steered our request to the
                // correct place. All we want to do is slightly modify the request we
                // were given (changing the extension) and check if that would resolve
                // instead.
                //
                // Currently this guard is only actually exercised in rollup, not in
                // vite, due to https://github.com/vitejs/vite/issues/13852
                enableCustomResolver: false,
                isExtensionSearch: true,
              },
            },
          });
        }

        if (!resolution) {
          return null;
        }
      }

      let syntheticId = needsSyntheticComponentJS(source, resolution.id);
      if (syntheticId && isInComponents(resolution.id, resolverLoader.resolver.packageCache)) {
        return {
          id: syntheticId,
          meta: {
            'rollup-hbs-plugin': {
              type: 'template-only-component-js',
            },
          },
        };
      }
    },

    load(id: string) {
      if (getMeta(this, id)?.type === 'template-only-component-js') {
        return {
          code: templateOnlyComponentSource(),
        };
      }
    },

    transform(code: string, id: string) {
      if (!hbsFilter(id)) {
        return null;
      }
      return hbsToJS(code);
    },
  };
}

type Meta = {
  type: 'template-only-component-js';
};

function getMeta(context: PluginContext, id: string): Meta | null {
  const meta = context.getModuleInfo(id)?.meta?.['rollup-hbs-plugin'];
  if (meta) {
    return meta as Meta;
  } else {
    return null;
  }
}
