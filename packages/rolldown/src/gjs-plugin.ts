import { Preprocessor } from 'content-tag';
import type { Plugin } from 'rolldown';

const processor = new Preprocessor();

export default function gjsPlugin(): Plugin {
  return {
    name: 'gjs-plugin',

    transform: {
      // Enforce running the gjs transform before any others like babel that expect valid JS
      order: 'pre',
      filter: {
        id: /\.g{j,t}s$/
      },
      handler(input: string, id: string) {
        let { code, map } = processor.process(input, {
          filename: id,
        });
        return {
          code,
          map,
        };
      },
    },
  };
}
