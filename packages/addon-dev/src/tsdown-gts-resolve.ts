import { Preprocessor } from 'content-tag';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Plugin } from 'rolldown';
import { fixDeclarationsInMatchingFiles } from './fix-declarations';

const processor = new Preprocessor();

/**
 * tsdown/rolldown only treats `.ts`/`.tsx`/`.mts` as TypeScript when deciding
 * whether to emit declarations, and its declaration engine cannot parse the
 * `<template>` syntax inside `.gts`/`.gjs` files.
 *
 * This plugin presents every `.gts`/`.gjs` module to rolldown under a virtual
 * `.ts`/`.js` id (so the extension-driven `.d.ts` emit treats it as TS/JS) and,
 * in the `load` hook, returns the content-tag-compiled source. Running
 * content-tag in `load` (rather than `transform`) is required because the
 * declaration pipeline reads module source via `load` but does not run the
 * regular `transform` hooks before generating declarations.
 */
export function emberGtsResolve(): Plugin {
  // virtual `.ts`/`.js` absolute id -> real `.gts`/`.gjs` absolute path
  const virtualToReal = new Map<string, string>();

  function virtualize(abs: string): string | null {
    if (abs.endsWith('.gts')) {
      const virtual = abs.slice(0, -'.gts'.length) + '.ts';
      virtualToReal.set(virtual, abs);
      return virtual;
    }
    if (abs.endsWith('.gjs')) {
      const virtual = abs.slice(0, -'.gjs'.length) + '.js';
      virtualToReal.set(virtual, abs);
      return virtual;
    }
    return null;
  }

  return {
    name: 'ember-gts-resolve',

    resolveId: {
      order: 'pre',
      handler(source, importer) {
        const base = importer ? path.dirname(importer) : process.cwd();
        const abs = path.isAbsolute(source)
          ? source
          : path.resolve(base, source);

        if (abs.endsWith('.gts') || abs.endsWith('.gjs')) {
          return virtualize(abs);
        }

        // extensionless relative import that exists on disk as `.gts`/`.gjs`
        if (
          (source.startsWith('.') || path.isAbsolute(source)) &&
          !path.extname(abs)
        ) {
          for (const ext of ['.gts', '.gjs']) {
            if (existsSync(abs + ext)) {
              return virtualize(abs + ext);
            }
          }
        }

        return null;
      },
    },

    load: {
      order: 'pre',
      async handler(id) {
        const real = virtualToReal.get(id);
        if (!real) return null;

        const source = await readFile(real, { encoding: 'utf8' });
        const { code, map } = processor.process(source, { filename: real });
        return { code, map: map as string };
      },
    },
  };
}

/**
 * Strips `.gts`/`.gjs` extensions from import specifiers in the emitted `.d.ts`
 * files, mirroring the post-processing the glint-based `declarations()` plugin
 * did. Acts as a safety net for any specifiers the declaration engine prints
 * verbatim (e.g. dynamic `import('./x.gts')`).
 */
export function fixDtsExtensions(outDir: string): Plugin {
  return {
    name: 'ember-fix-dts-extensions',
    writeBundle: () => fixDeclarationsInMatchingFiles(outDir),
  };
}
