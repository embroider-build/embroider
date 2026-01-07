import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    transform: {
      filter: {
        id: '**/*.{gjs,gts}?(\\?)*',
      },
      handler(code: string, id: string) {
        return preprocessor.process(code, {
          filename: id,
        });
      },
    },
  };
}
