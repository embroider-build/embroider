import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, templateOnlyComponentSource } from '@embroider/core';
import { buildIdFilter } from './build-id-filter.js';

export const hbsFilter = buildIdFilter({ extensions: ['hbs'] });

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

    transform: {
      filter: hbsFilter,
      // SAFETY: TS complains because hbsToJS doesn't take more than one arg
      //         But we have no need to warrant an extra function
      //         to just strip the extra arguments
      // @ts-expect-error
      handler: hbsToJS,
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
