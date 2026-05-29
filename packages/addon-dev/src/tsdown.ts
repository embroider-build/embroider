import path from 'path';
import type { UserConfig } from 'tsdown';
import type { Plugin } from 'rolldown';
import type { Addon } from './rollup';
import { discoverEntrypoints } from './entrypoints';
import { emberGtsResolve, fixDtsExtensions } from './tsdown-gts-resolve';

type AppReexports =
  | string[]
  | {
      include: string[];
      mapFilename?: (fileName: string) => string;
      exports?: (filename: string) => string[] | string | undefined;
      exclude?: string[];
    };

export interface TsdownOptions {
  // Globs describing the modules users should be able to import from your addon
  // (the same patterns you would pass to `addon.publicEntrypoints`).
  publicEntrypoints: string[];

  // Globs that should be excluded from the public entrypoints.
  entryExclude?: string[];

  // Modules that should be reexported into the traditional "app" tree (the same
  // value you would pass to `addon.appReexports`).
  appReexports?: AppReexports;

  // Options forwarded to `addon.hbs` (e.g. `{ excludeColocation: [...] }`).
  hbs?: Parameters<Addon['hbs']>[0];

  // CSS/asset globs to preserve. Each entry is forwarded to `addon.keepAssets`.
  keepAssets?: { include: string[]; exports?: 'default' | '*' }[];

  // Public asset folders, as `[path, opts?]` tuples forwarded to
  // `addon.publicAssets`.
  publicAssets?: [path: string, opts?: Parameters<Addon['publicAssets']>[1]][];

  // Whether to emit `.d.ts` declarations via tsdown. Defaults to `true`.
  declarations?: boolean;

  // Module-type (loader) overrides forwarded to tsdown, for custom asset
  // extensions handled by your own plugins (e.g. `{ '.xyz': 'js' }`).
  loader?: Record<string, string>;

  // Extra plugins (e.g. `@rollup/plugin-babel`) to run during the build.
  plugins?: unknown[];
}

// Pulls extensions out of globs like `**/*.css` and `**/*.{png,jpg}`.
function extensionsFromGlobs(globs: string[]): string[] {
  const exts = new Set<string>();
  for (const glob of globs) {
    const braces = glob.match(/\.\{([^}]+)\}$/);
    if (braces) {
      for (const ext of braces[1].split(',')) {
        exts.add('.' + ext.trim());
      }
      continue;
    }
    const single = glob.match(/\.([A-Za-z0-9]+)$/);
    if (single) {
      exts.add('.' + single[1]);
    }
  }
  return [...exts];
}

// The rollup `keepAssets` plugin's `load`/`transform` are written as plain
// hook functions, relying on rollup's fall-through ordering. Under rolldown,
// tsdown registers internal plugins whose normal-order `load` would otherwise
// read the asset (as UTF-8) before keepAssets can claim it, so we re-register
// keepAssets' hooks at `order: 'pre'`.
function asPreLoad(plugin: unknown): unknown {
  const wrapped: Record<string, unknown> = { ...(plugin as object) };
  for (const hook of ['load', 'transform'] as const) {
    const fn = (plugin as Record<string, unknown>)[hook];
    if (typeof fn === 'function') {
      wrapped[hook] = { order: 'pre', handler: fn };
    }
  }
  return wrapped;
}

// Builds a tsdown config (compatible with tsdown's `defineConfig`) that produces
// the same v2-addon output as the rollup `Addon` pipeline: multi-entry
// code-splitting, app-tree reexports, and (via tsdown's `dts`)
// declarations - replacing the separate glint/ember-tsc subprocess.
export function tsdown(addon: Addon, options: TsdownOptions): UserConfig {
  const srcDir = addon.srcDir;
  const destDir = addon.destDir;

  const entry: Record<string, string> = {};
  for (const { idName, fileName } of discoverEntrypoints({
    srcDir,
    include: options.publicEntrypoints,
    exclude: options.entryExclude,
  })) {
    const name = fileName.replace(/\.js$/, '');
    entry[name] = path.resolve(srcDir, idName);
  }

  const hasKeepAssets = (options.keepAssets ?? []).length > 0;

  // rolldown assigns `.css` (and friends) the `css` module type and refuses to
  // bundle them. Kept CSS is preserved as-is by `keepAssets`, so treat those
  // extensions as `js` - `keepAssets`'s load/transform then capture the source
  // and replace it with a marker before it is parsed.
  const CSS_LIKE = ['.css', '.less', '.sass', '.scss', '.styl', '.stylus'];
  const loader: Record<string, string> = {};
  for (const ext of extensionsFromGlobs(
    (options.keepAssets ?? []).flatMap((k) => k.include)
  )) {
    if (CSS_LIKE.includes(ext)) {
      loader[ext] = 'js';
    }
  }
  Object.assign(loader, options.loader);

  const appReexports = options.appReexports;
  const reexportPlugin = appReexports
    ? Array.isArray(appReexports)
      ? addon.appReexports(appReexports)
      : addon.appReexports(appReexports.include, appReexports)
    : undefined;

  const plugins: unknown[] = [
    emberGtsResolve(),
    reexportPlugin,
    ...(options.plugins ?? []),
    addon.dependencies(),
    addon.hbs(options.hbs),
    ...(options.keepAssets ?? []).map(({ include, exports }) =>
      asPreLoad(addon.keepAssets(include, exports))
    ),
    ...(options.publicAssets ?? []).map(([assetPath, opts]) =>
      addon.publicAssets(assetPath, opts)
    ),
    addon.clean(),
    fixDtsExtensions(destDir),
  ].filter(Boolean);

  return {
    entry,
    // Deliberately NOT `unbundle: true`. v2-addon output matches rollup's
    // multi-entry code-splitting: each public entrypoint is its own chunk,
    // single-use private modules (e.g. colocated compiled templates, babel
    // helpers) inline into their consumer. `unbundle`/`preserveModules` would
    // instead emit every module as its own file, diverging from rollup.
    //
    // `preserveEntrySignatures: 'allow-extension'` keeps each public entrypoint
    // as its own chunk with its real code (importable by apps) while letting
    // one entrypoint import another directly - without rolldown's default
    // behaviour of extracting a shared hashed chunk + facade.
    inputOptions: {
      preserveEntrySignatures: 'allow-extension',
    },
    format: 'es',
    sourcemap: true,
    outDir: destDir,
    // The reused `addon.clean()` plugin owns incremental dist diffing; let it
    // manage deletions instead of tsdown wiping the whole outDir each run.
    clean: false,
    // `oxc: true` forces oxc-powered isolated declarations, which operate on the
    // (content-tag compiled) source our `load` hook returns rather than reading
    // `.gts`/`.gjs` from disk via the TypeScript compiler.
    dts: options.declarations === false ? false : { oxc: true },
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    loader: loader as UserConfig['loader'],
    plugins: plugins as Plugin[],
    // When keepAssets is used, the addon owns asset handling (incl. CSS), so
    // remove tsdown's built-in CSS guard, which would otherwise throw on any
    // `.css` module before keepAssets can preserve it. We strip it from the
    // resolved rolldown options just before the build runs.
    hooks: hasKeepAssets
      ? {
          'build:before'(ctx: { buildOptions: { plugins?: unknown } }) {
            const opts = ctx.buildOptions;
            if (Array.isArray(opts.plugins)) {
              opts.plugins = opts.plugins.filter(
                (p) =>
                  !(
                    p &&
                    typeof p === 'object' &&
                    (p as { name?: string }).name === 'tsdown:css-guard'
                  )
              );
            }
          },
        }
      : undefined,
  } as UserConfig;
}
