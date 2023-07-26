import { createFilter } from '@rollup/pluginutils';
import type { Plugin, PluginContext, CustomPluginOptions } from 'rollup';
import { readFileSync } from 'fs';
import { hbsToJS } from '@embroider/core';
import { parse as pathParse } from 'path';

export default function rollupHbsPlugin(): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      if (resolution) {
        return resolution;
      } else {
        return maybeSynthesizeComponentJS(this, source, importer, options);
      }
    },

    load(id: string) {
      if (hbsFilter(id)) {
        let input = readFileSync(id, 'utf8');
        let code = hbsToJS(input);
        return {
          code,
        };
      }
      if (getMeta(this, id)) {
        return {
          code: templateOnlyComponent,
        };
      }
    },
  };
}

const templateOnlyComponent =
  `import templateOnly from '@ember/component/template-only';\n` +
  `export default templateOnly();\n`;

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

function correspondingTemplate(filename: string): string {
  let { ext } = pathParse(filename);
  return filename.slice(0, filename.length - ext.length) + '.hbs';
}

async function maybeSynthesizeComponentJS(
  context: PluginContext,
  source: string,
  importer: string | undefined,
  options: { custom?: CustomPluginOptions; isEntry: boolean }
) {
  let templateResolution = await context.resolve(
    correspondingTemplate(source),
    importer,
    {
      skipSelf: true,
      ...options,
    }
  );
  if (!templateResolution) {
    return null;
  }
  // we're trying to resolve a JS module but only the corresponding HBS
  // file exists. Synthesize the template-only component JS.
  return {
    id: templateResolution.id.replace(/\.hbs$/, '.js'),
    meta: {
      'rollup-hbs-plugin': {
        type: 'template-only-component-js',
      },
    },
  };
}

const hbsFilter = createFilter('**/*.hbs');
