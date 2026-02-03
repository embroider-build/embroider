import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

const gjsPathFilter = createFilter('**/*.{gjs,gts}');

export function gjsFilter(id: string): boolean {
  // Vite ids can contain a query string. We intentionally ignore it so that
  // `app/foo.gjs.js?pretend.gjs` doesn't count as a .gjs file.
  let [path] = id.split('?');
  return gjsPathFilter(path);
}

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    transform(code: string, id: string) {
      if (!gjsFilter(id)) {
        return null;
      }
      return preprocessor.process(code, {
        filename: id,
      });
    },
  };
}
