import { createFilter } from '@rollup/pluginutils';
import type { PluginContext } from 'rollup';
import type { Plugin, ViteDevServer } from 'vite';
import makeDebug from 'debug';

const debug = makeDebug('embroider:vite');

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
  let server: ViteDevServer;
  let virtualDeps: Map<string, string[]> = new Map();

  return {
    name: 'rollup-hbs-plugin',
    enforce: 'pre',

    configureServer(s) {
      server = s;
      server.watcher.on('all', (_eventName, path) => {
        for (let [id, watches] of virtualDeps) {
          for (let watch of watches) {
            if (path.startsWith(watch)) {
              debug('Invalidate %s because %s', id, path);
              server.moduleGraph.onFileChange(id);
              let m = server.moduleGraph.getModuleById(id);
              if (m) {
                server.reloadModule(m);
              }
            }
          }
        }
      });
    },

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

      if (isInComponents(resolution.id, resolverLoader.resolver.packageCache)) {
        let syntheticId = needsSyntheticComponentJS(source, resolution.id);
        if (syntheticId) {
          virtualDeps.set(syntheticId, [resolution.id]);
          return {
            id: syntheticId,
            meta: {
              'rollup-hbs-plugin': {
                type: 'template-only-component-js',
              },
            },
          };
        } else {
          let correspondingHBS = syntheticJStoHBS(resolution.id);
          if (correspondingHBS) {
            virtualDeps.set(resolution.id, [correspondingHBS]);
          }
        }
      }

      // we should be able to clear any earlier meta by returning
      // resolution.meta here, but vite breaks that rollup feature.
      let meta = getMeta(this, resolution.id);
      if (meta) {
        meta.type = null;
      }

      return resolution;
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
  type: 'template-only-component-js' | null;
};

function getMeta(context: PluginContext, id: string): Meta | null {
  const meta = context.getModuleInfo(id)?.meta?.['rollup-hbs-plugin'];
  if (meta) {
    return meta as Meta;
  } else {
    return null;
  }
}
