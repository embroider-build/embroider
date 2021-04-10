import { parse } from 'path';
import type { Plugin as RollupPlugin } from 'rollup';
import { applyVariantToTemplateCompiler, Variant } from '@embroider/core';

export interface Options {
  templateCompilerFile: string;
  variant: Variant;
}

export default function glimmerTemplateCompilerPlugin({ templateCompilerFile, variant }: Options): RollupPlugin {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const templateCompiler = applyVariantToTemplateCompiler(variant, require(templateCompilerFile)).compile;

  return {
    name: '@embroider/rollup-plugin-hbs',

    transform(src, id) {
      const parsedFilePath = parse(id);

      if (parsedFilePath.ext === '.hbs') {
        return templateCompiler(id, src);
      }
    },
  };
}
