// TODO: I copied this from @embroider/addon-dev, it needs to be its own package
// (or be in shared-internals or core)
import { createFilter } from '@rollup/pluginutils';
import type { PluginContext, ResolvedId } from 'rollup';
import type { Plugin } from 'vite';
import { hbsToJS, ResolverLoader } from '@embroider/core';
import assertNever from 'assert-never';
import { readFileSync } from 'fs-extra';
import { parse as pathParse } from 'path';
import makeDebug from 'debug';

const debug = makeDebug('embroider:hbs-plugin');
const resolverLoader = new ResolverLoader(process.cwd());

export function hbs(): Plugin {
  return {
    name: 'rollup-hbs-plugin',
    enforce: 'pre',
    async resolveId(source: string, importer: string | undefined, options) {
      if (options.custom?.embroider?.isExtensionSearch) {
        return null;
      }
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
      });

      if (!resolution) {
        return maybeSynthesizeComponentJS(this, source, importer);
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
          let code = hbsToJS(`${readFileSync(id)}`);
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

async function maybeSynthesizeComponentJS(context: PluginContext, source: string, importer: string | undefined) {
  debug(`checking for template-only component: %s`, source);
  let templateResolution = await context.resolve(correspondingTemplate(source), importer, {
    skipSelf: true,
    custom: {
      embroider: {
        // we don't want to recurse into the whole embroider compatbility
        // resolver here. It has presumably already steered our request to the
        // correct place. All we want to do is slightly modify the request we
        // were given (changing the extension) and check if that would resolve
        // instead.
        //
        // Currently this guard is only actually exercised in rollup, not in
        // vite, due to https://github.com/vitejs/vite/issues/13852
        enableCustomResolver: false,
        isExtensionSearch: true,
      },
    },
  });
  if (!templateResolution) {
    return null;
  }

  const resolvedId = templateResolution.id.split('?')[0];
  templateResolution.id = resolvedId;

  const pkg = resolverLoader.resolver.packageCache.ownerOfFile(resolvedId);
  const isInComponents = pkg?.isV2App() && resolvedId.slice(pkg?.root.length).startsWith('/components');

  if (resolvedId.endsWith('/template.hbs') || !isInComponents) {
    return {
      ...templateResolution,
      meta: {
        'rollup-hbs-plugin': {
          type: 'template',
        },
      },
    };
  }

  debug(`emitting template only component: %s`, templateResolution.id);

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

const hbsFilter = createFilter('**/*.hbs?([?]*)');

function maybeRewriteHBS(resolution: ResolvedId) {
  if (!hbsFilter(resolution.id)) {
    return null;
  }
  debug('emitting hbs rewrite: %s', resolution.id);
  return {
    ...resolution,
    meta: {
      'rollup-hbs-plugin': {
        type: 'template',
      },
    },
  };
}
