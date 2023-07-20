import { createFilter } from '@rollup/pluginutils';
import type { Plugin, PluginContext, ResolvedId } from 'rollup';
import { readFileSync } from 'fs';
import { Preprocessor } from 'content-tag';

const PLUGIN_NAME = 'rollup-gjs-plugin';

const processor = new Preprocessor();
// import { parse as pathParse } from 'path';

export default function rollupGjsPlugin(): Plugin {
  return {
    name: PLUGIN_NAME,
    async resolveId(source: string, importer: string | undefined, options) {
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      if (resolution) {
        return maybeRewriteGJS(resolution);
      }
    },

    load(id: string) {
      const meta = getMeta(this, id);
      if (!meta) {
        return;
      }

      this.addWatchFile(meta.originalId);
      let input = readFileSync(meta.originalId, 'utf8');
      let code = processor.process(input);
      return {
        code,
      };
    },
  };
}

type Meta = {
  originalId: string;
};

function getMeta(context: PluginContext, id: string): Meta | null {
  const meta = context.getModuleInfo(id)?.meta?.[PLUGIN_NAME];
  if (meta) {
    return meta as Meta;
  } else {
    return null;
  }
}

const gjsFilter = createFilter('**/*.g{j,t}s');

function maybeRewriteGJS(resolution: ResolvedId) {
  if (!gjsFilter(resolution.id)) {
    return null;
  }

  let id;

  if (resolution.id.endsWith('.gjs')) {
    id = resolution.id.replace(/\.gjs$/, '.js');
  } else if (resolution.id.endsWith('.gts')) {
    id = resolution.id.replace(/\.gts$/, '.ts');
  } else {
    throw new Error(
      'Unexpected issues in the plugin-rollup-gjs - an unexpected file made its way throught the pluginUtils filter'
    );
  }

  // This creates an `*.js` or `*.ts` that **replaces** the .gjs or .gts file that we will populate in `load()` hook.
  return {
    ...resolution,
    id,
    meta: {
      [PLUGIN_NAME]: {
        originalId: resolution.id,
      },
    },
  };
}
