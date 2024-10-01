import type { Plugin, PluginContext } from 'rollup';
import { createFilter } from '@rollup/pluginutils';
import minimatch from 'minimatch';
import {
  hbsToJS,
  templateOnlyComponentSource,
  needsSyntheticComponentJS,
  syntheticJStoHBS,
} from '@embroider/core';
import { extname } from 'path';

const hbsFilter = createFilter('**/*.hbs?([?]*)');

export default function rollupHbsPlugin({
  excludeColocation,
}: {
  excludeColocation?: string[];
}): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      if (options.custom?.embroider?.isExtensionSearch) {
        return null;
      }

      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
      });

      if (!resolution && extname(source) === '') {
        resolution = await this.resolve(source + '.hbs', importer, {
          skipSelf: true,
        });
      }

      if (!resolution) {
        let hbsSource = syntheticJStoHBS(source);
        if (hbsSource) {
          resolution = await this.resolve(hbsSource, importer, {
            skipSelf: true,
            custom: {
              embroider: {
                isExtensionSearch: true,
              },
            },
          });
        }

        if (!resolution) {
          return null;
        }
      }

      if (resolution && resolution.id.endsWith('.hbs')) {
        let isExcluded = excludeColocation?.some((glob) =>
          minimatch(resolution!.id, glob)
        );
        if (isExcluded) {
          return resolution;
        }
      }

      let syntheticId = needsSyntheticComponentJS(source, resolution.id);
      if (syntheticId) {
        this.addWatchFile(source);
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
        this.addWatchFile(id);
        return {
          code: templateOnlyComponentSource(),
        };
      }
    },

    transform(code: string, id: string) {
      let hbsFilename = id.replace(/\.\w{1,3}$/, '') + '.hbs';
      if (hbsFilename !== id) {
        this.addWatchFile(hbsFilename);
        if (getMeta(this, id)?.type === 'template-only-component-js') {
          this.addWatchFile(id);
        }
      }
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
