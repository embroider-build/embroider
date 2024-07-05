import { createFilter } from '@rollup/pluginutils';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, ResolverLoader, needsSyntheticComponentJS, templateOnlyComponentSource } from '@embroider/core';

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
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
      });

      if (!resolution) {
        return null;
      }

      let syntheticId = needsSyntheticComponentJS(source, resolution.id, resolverLoader.resolver.packageCache);
      if (syntheticId) {
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
