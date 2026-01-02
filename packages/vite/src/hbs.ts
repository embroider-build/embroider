import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, templateOnlyComponentSource } from '@embroider/core';

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
      filter: {
        id: '**/*.hbs?([?]*)',
      },
      handler(code: string) {
        return hbsToJS(code);
      },
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
