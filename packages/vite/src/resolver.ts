import { type Plugin, type ViteDevServer, normalizePath } from 'vite';
import core, { ModuleRequest, type Resolver } from '@embroider/core';
const { virtualContent, ResolverLoader, explicitRelative, cleanUrl, tmpdir } = core;
import { type ResponseMeta, RollupRequestAdapter } from './request.js';
import { assertNever } from 'assert-never';
import makeDebug from 'debug';
import { join, normalize, resolve } from 'path';
import { writeStatus } from './backchannel.js';
import type { PluginContext, ResolveIdResult } from 'rollup';
import { externalName } from '@embroider/reverse-exports';
import fs from 'fs-extra';
import { createHash } from 'crypto';
import { BackChannel } from './backchannel.js';

const { ensureSymlinkSync, outputJSONSync } = fs;

const debug = makeDebug('embroider:vite');

export function resolver(params?: { rolldown?: boolean }): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  let server: ViteDevServer;
  const virtualDeps: Map<string, string[]> = new Map();
  const notViteDeps = new Set<string>();
  const responseMetas: Map<string, ResponseMeta> = new Map();
  const backChannel = params?.rolldown ? new BackChannel() : undefined;

  async function resolveId(
    context: PluginContext,
    source: string,
    importer: string | undefined,
    options: { custom?: Record<string, unknown>; scan?: boolean }
  ) {
    // @ts-ignore
    if (context.outputOptions?.dir?.includes('.vite')) {
      // TODO: this is the phase where we need to do what the esbuild plugin
      // calls the "bundling" phase to prevent recursion into the app
    }

    // vite 5 exposes `custom.depscan`, vite 6 exposes `options.scan`
    if (options.custom?.depScan || options.scan) {
      return await observeDepScan(context, source, importer, options);
    }

    let request = ModuleRequest.create(RollupRequestAdapter.create, {
      context,
      source,
      importer,
      custom: options.custom,
      backChannel,
    });
    if (!request) {
      // fallthrough to other rollup plugins
      return null;
    }
    let resolution = await resolverLoader.resolver.resolve(request);
    switch (resolution.type) {
      case 'found':
        if (resolution.virtual) {
          return resolution.result;
        } else {
          return await maybeCaptureNewOptimizedDep(context, resolverLoader.resolver, resolution.result, notViteDeps);
        }
      case 'not_found':
        return null;
      default:
        throw assertNever(resolution);
    }
  }

  async function ensureVirtualResolve(context: PluginContext, specifier: string): Promise<ResponseMeta> {
    let result = await resolveId(
      context,
      specifier,
      resolve(resolverLoader.resolver.options.appRoot, 'package.json'),
      {}
    );
    if (!result) {
      throw new Error(`bug: expected to resolve ${specifier}`);
    }
    if (typeof result === 'string') {
      throw new Error(`bug: expected to get a PartialResolvedId`);
    }
    let meta = result.meta?.['embroider-resolver'] as ResponseMeta | undefined;
    if (!meta) {
      throw new Error(`bug: no response meta for ${specifier}`);
    }
    return meta;
  }

  async function emitVirtualFile(context: PluginContext, fileName: string): Promise<void> {
    context.emitFile({
      type: 'asset',
      fileName,
      source: virtualContent((await ensureVirtualResolve(context, fileName)).virtual, resolverLoader.resolver).src,
    });
  }

  let mode = '';

  return {
    name: 'embroider-resolver',
    enforce: 'pre',

    configResolved(config) {
      mode = config.mode;
    },

    configureServer(s) {
      server = s;
      server.watcher.on('all', (_eventName, path) => {
        for (let [id, watches] of virtualDeps) {
          for (let watch of watches) {
            if (path.startsWith(watch)) {
              debug('Invalidate %s because %s', id, path);
              server.moduleGraph.onFileChange(id);
              let m = server.moduleGraph.getModuleById(id);
              if (m) {
                server.reloadModule(m);
              }
            }
          }
        }
      });
      return () => {
        server.middlewares.use((req, _res, next) => {
          const base = server.config.base || '/';
          let originalUrl = req.originalUrl;
          if (originalUrl?.startsWith(base)) {
            originalUrl = req.originalUrl!.slice(base.length - 1);
          }
          if (originalUrl && originalUrl.length > 1) {
            if (originalUrl?.match(/^\/tests($|\?)/)) {
              req.url = `/tests/index.html`;
              return next();
            }
          }
          return next();
        });
      };
    },

    async resolveId(source, importer, options) {
      let resolution = await resolveId(this, source, importer, options);
      if (typeof resolution === 'string') {
        return resolution;
      }
      if (resolution && resolution.meta?.['embroider-resolver']) {
        responseMetas.set(normalizePath(resolution.id), resolution.meta['embroider-resolver'] as ResponseMeta);
      }
      return resolution;
    },

    load(id) {
      let meta = responseMetas.get(normalizePath(id));
      if (meta?.virtual) {
        let { src, watches } = virtualContent(meta.virtual, resolverLoader.resolver);
        virtualDeps.set(id, watches);
        server?.watcher.add(watches);
        return src;
      }
    },
    async buildEnd() {
      emitVirtualFile(this, '@embroider/virtual/vendor.js');
      emitVirtualFile(this, '@embroider/virtual/vendor.css');

      if (mode !== 'production') {
        emitVirtualFile(this, '@embroider/virtual/test-support.js');
        emitVirtualFile(this, '@embroider/virtual/test-support.css');
      }
    },
  };
}

// During depscan, we have a wildly different job than during normal
// usage. Embroider's esbuild resolver plugin replaces this rollup
// resolver plugin for actually doing resolving, so we don't do any of
// that. But we are still well-positioned to observe what vite's rollup
// resolver plugin is doing, and that is important because vite's
// esbuild depscan plugin will always obscure the results before
// embroider's esbuild resolver plugin can see them. It obscures the
// results by marking *both* "not found" and "this is a third-party
// package" as "external: true". We really care about the difference
// between the two, since we have fallback behaviors that should apply
// to "not found" that should not apply to successfully discovered
// third-party packages.
async function observeDepScan(context: PluginContext, source: string, importer: string | undefined, options: any) {
  let result = await context.resolve(source, importer, {
    ...options,
    skipSelf: true,
  });
  writeStatus(source, importer ?? '', result ? { type: 'found', filename: result.id } : { type: 'not_found' });
  return result;
}

function idFromResult(result: ResolveIdResult): string | undefined {
  if (!result) {
    return undefined;
  }
  if (typeof result === 'string') {
    return cleanUrl(result);
  }
  return cleanUrl(result.id);
}

function hashed(path: string): string {
  let h = createHash('sha1');
  return h.update(path).digest('hex').slice(0, 8);
}

async function maybeCaptureNewOptimizedDep(
  context: PluginContext,
  resolver: Resolver,
  result: ResolveIdResult,
  notViteDeps: Set<string>
): Promise<ResolveIdResult> {
  let foundFile = idFromResult(result);
  if (!foundFile) {
    return result;
  }
  if (
    foundFile.includes('.vite') &&
    normalize(foundFile).startsWith(join(resolver.packageCache.appRoot, 'node_modules', '.vite'))
  ) {
    debug('maybeCaptureNewOptimizedDep: %s already in vite deps', foundFile);
    return result;
  }
  let pkg = resolver.packageCache.ownerOfFile(foundFile);
  if (!pkg?.isV2Addon()) {
    debug('maybeCaptureNewOptimizedDep: %s not in v2 addon', foundFile);
    return result;
  }
  let target = externalName(pkg.packageJSON, explicitRelative(pkg.root, foundFile));
  if (!target) {
    debug('maybeCaptureNewOptimizedDep: %s is not exported', foundFile);
    return result;
  }

  if (notViteDeps.has(foundFile)) {
    debug('maybeCaptureNewOptimizedDep: already attempted %s', foundFile);
    return result;
  }

  debug('maybeCaptureNewOptimizedDep: doing re-resolve for %s ', foundFile);

  let jumpRoot = join(tmpdir, 'embroider-vite-jump', hashed(pkg.root));
  let fromFile = join(jumpRoot, 'package.json');
  outputJSONSync(fromFile, {
    name: 'jump-root',
  });
  ensureSymlinkSync(pkg.root, join(jumpRoot, 'node_modules', pkg.name));
  let newResult = await context.resolve(target, fromFile);
  if (newResult) {
    if (idFromResult(newResult) === foundFile) {
      // This case is normal. For example, people could be using
      // `optimizeDeps.exclude` or they might be working in a monorepo where an
      // addon is not in node_modules. In both cases vite will decide not to
      // optimize the file, even though we gave it a chance to.
      //
      // We cache that result so we don't keep trying.
      debug('maybeCaptureNewOptimizedDep: %s did not become an optimized dep', foundFile);
      notViteDeps.add(foundFile);
    }

    return newResult;
  } else {
    return result;
  }
}
