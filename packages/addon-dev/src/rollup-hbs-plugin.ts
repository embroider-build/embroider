import { createFilter } from '@rollup/pluginutils';
import type { Plugin, PluginContext, CustomPluginOptions } from 'rollup';
import { readFileSync } from 'fs';
import { correspondingTemplate, hbsToJS } from '@embroider/core';
import minimatch from 'minimatch';

export default function rollupHbsPlugin({
  excludeColocation,
}: {
  excludeColocation?: string[];
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
          excludeColocation
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

async function maybeSynthesizeComponentJS(
  context: PluginContext,
  source: string,
  importer: string | undefined,
  options: { custom?: CustomPluginOptions; isEntry: boolean },
  excludeColocation: string[] | undefined
) {
  let hbsFilename = correspondingTemplate(source);
  let templateResolution = await context.resolve(hbsFilename, importer, {
    skipSelf: true,
    ...options,
  });
  if (!templateResolution) {
    return null;
  }
  let type = excludeColocation?.some((glob) => minimatch(hbsFilename, glob))
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
