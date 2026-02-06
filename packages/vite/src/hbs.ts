import { createFilter } from '@rollup/pluginutils';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, templateOnlyComponentSource } from '@embroider/core';

const hbsPathFilter = createFilter('**/*.hbs');

export function hbsFilter(id: string): boolean {
  let [path] = id.split('?');
  return hbsPathFilter(path);
}

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
