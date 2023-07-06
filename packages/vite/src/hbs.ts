// TODO: I copied this from @embroider/addon-dev, it needs to be its own package
// (or be in shared-internals or core)
import { createFilter } from '@rollup/pluginutils';
import type { Plugin, PluginContext, CustomPluginOptions, ResolvedId } from 'rollup';
import { readFileSync } from 'fs';
import { hbsToJS } from '@embroider/core';
import assertNever from 'assert-never';
import { parse as pathParse } from 'path';

export function hbs(): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      if (!resolution) {
        return maybeSynthesizeComponentJS(this, source, importer, options);
      } else {
        return maybeRewriteHBS(resolution);
      }
    },

    load(id: string) {
      const meta = getMeta(this, id);
      if (!meta) {
        return;
      }

      switch (meta.type) {
        case 'template':
          let input = readFileSync(id, 'utf8');
          let code = hbsToJS(input);
          return {
            code,
          };
        case 'template-only-component-js':
          return {
            code: templateOnlyComponent,
          };
        default:
          assertNever(meta);
      }
    },
  };
}

const templateOnlyComponent =
  `import templateOnly from '@ember/component/template-only';\n` + `export default templateOnly();\n`;

type Meta =
  | {
      type: 'template';
    }
  | {
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
  let templateResolution = await context.resolve(correspondingTemplate(source), importer, {
    skipSelf: true,
    ...options,
  });
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

function maybeRewriteHBS(resolution: ResolvedId) {
  if (!hbsFilter(resolution.id)) {
    return null;
  }

  return {
    ...resolution,
    meta: {
      'rollup-hbs-plugin': {
        type: 'template',
      },
    },
  };
}
