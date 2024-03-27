import { createFilter } from '@rollup/pluginutils';
import type { Plugin, PluginContext, CustomPluginOptions } from 'rollup';
import { readFileSync } from 'fs';
import { hbsToJS } from '@embroider/core';
import minimatch from 'minimatch';
import { parse as pathParse } from 'path';

export default function rollupHbsPlugin({
  templates,
}: {
  templates?: string[];
}): Plugin {
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
        return maybeSynthesizeComponentJS(
          this,
          source,
          importer,
          options,
          templates
        );
      }
    },

    load(id: string) {
      if (hbsFilter(id)) {
        return getHbsToJSCode(id);
      }
      let meta = getMeta(this, id);
      if (meta) {
        if (meta?.type === 'template-js') {
          const hbsFile = id.replace(/\.js$/, '.hbs');
          return getHbsToJSCode(hbsFile);
        }
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
  type: 'template-only-component-js' | 'template-js';
};

function getMeta(context: PluginContext, id: string): Meta | null {
  const meta = context.getModuleInfo(id)?.meta?.['rollup-hbs-plugin'];
  if (meta) {
    return meta as Meta;
  } else {
    return null;
  }
}

function getHbsToJSCode(file: string): { code: string } {
  let input = readFileSync(file, 'utf8');
  let code = hbsToJS(input);
  return {
    code,
  };
}

function correspondingTemplate(filename: string): string {
  let { ext } = pathParse(filename);
  return filename.slice(0, filename.length - ext.length) + '.hbs';
}

async function maybeSynthesizeComponentJS(
  context: PluginContext,
  source: string,
  importer: string | undefined,
  options: { custom?: CustomPluginOptions; isEntry: boolean },
  templates: string[] | undefined
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
  let type = templates?.some((glob) => minimatch(source, glob))
    ? 'template-js'
    : 'template-only-component-js';
  // we're trying to resolve a JS module but only the corresponding HBS
  // file exists. Synthesize the JS. The meta states if the hbs corresponds
  // to a template-only component or a simple template like a route template.
  return {
    id: templateResolution.id.replace(/\.hbs$/, '.js'),
    meta: {
      'rollup-hbs-plugin': {
        type,
      },
    },
  };
}

const hbsFilter = createFilter('**/*.hbs');
