import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, templateOnlyComponentSource } from '@embroider/core';
import { extFilter, supportsObjectHooks } from './build-id-filter.js';

export const hbsFilter = extFilter('hbs');

export function hbs(): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    enforce: 'pre',

    load(id: string) {
      if (getMeta(this, id)?.type === 'template-only-component-js') {
        return {
          code: templateOnlyComponentSource(),
        };
      }
    },

    transform: supportsObjectHooks
      ? {
          filter: { id: hbsFilter },
          handler(code: string) {
            return hbsToJS(code);
          },
        }
      : function (code: string, id: string) {
          if (!hbsFilter.test(id)) return null;
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
