import { type ModuleRequest, cleanUrl, packageName } from '@embroider/core';
import type { ImportKind, OnResolveResult, PluginBuild, ResolveResult } from 'esbuild';
import { dirname, extname } from 'path';

import type { PackageCache as _PackageCache, Resolution } from '@embroider/core';
import { externalName } from '@embroider/reverse-exports';

// TODO: make this share with vite config. We may need to pass it directly as an
// argument to our esbuild plugin, or perhaps share it via embroider's
// resolver-config.json
const extensions = ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.json'];

type PublicAPI<T> = { [K in keyof T]: T[K] };
type PackageCache = PublicAPI<_PackageCache>;

export class EsBuildModuleRequest implements ModuleRequest {
  static from(
    packageCache: PackageCache,
    context: PluginBuild,
    kind: ImportKind,
    source: string,
    importer: string | undefined,
    pluginData: Record<string, any> | undefined
  ): EsBuildModuleRequest | undefined {
    if (!(pluginData?.embroider?.enableCustomResolver ?? true)) {
      return;
    }

    if (source && importer && source[0] !== '\0' && !source.startsWith('virtual-module:')) {
      let fromFile = cleanUrl(importer);
      return new EsBuildModuleRequest(
        packageCache,
        context,
        kind,
        source,
        fromFile,
        pluginData?.embroider?.meta,
        false,
        false,
        undefined
      );
    }
  }

  private constructor(
    private packageCache: PackageCache,
    private context: PluginBuild,
    private kind: ImportKind,
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isVirtual: boolean,
    readonly isNotFound: boolean,
    readonly resolvedTo: Resolution<OnResolveResult, OnResolveResult> | undefined
  ) {
    let plugins = (this.context.initialOptions.plugins ?? []).map(p => p.name);
    if (plugins.includes('vite:dep-pre-bundle')) {
      this.phase = 'bundling';
    } else if (plugins.includes('vite:dep-scan')) {
      this.phase = 'scanning';
    } else {
      throw new Error(`cannot identify what phase vite is in. Saw plugins: ${plugins.join(', ')}`);
    }
  }

  get debugType() {
    return 'esbuild';
  }

  alias(newSpecifier: string) {
    return new EsBuildModuleRequest(
      this.packageCache,
      this.context,
      this.kind,
      newSpecifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      false,
      undefined
    ) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new EsBuildModuleRequest(
        this.packageCache,
        this.context,
        this.kind,
        this.specifier,
        newFromFile,
        this.meta,
        this.isVirtual,
        false,
        undefined
      ) as this;
    }
  }
  virtualize(filename: string) {
    return new EsBuildModuleRequest(
      this.packageCache,
      this.context,
      this.kind,
      filename,
      this.fromFile,
      this.meta,
      true,
      false,
      undefined
    ) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new EsBuildModuleRequest(
      this.packageCache,
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      meta,
      this.isVirtual,
      this.isNotFound,
      this.resolvedTo
    ) as this;
  }
  notFound(): this {
    return new EsBuildModuleRequest(
      this.packageCache,
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      true,
      undefined
    ) as this;
  }

  resolveTo(resolution: Resolution<OnResolveResult, OnResolveResult>): this {
    return new EsBuildModuleRequest(
      this.packageCache,
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      this.isNotFound,
      resolution
    ) as this;
  }

  private phase: 'bundling' | 'scanning';

  private *extensionSearch(specifier: string): Generator<string> {
    yield specifier;
    // when there's no explicit extension, we may do extension search
    if (extname(specifier) === '') {
      // during the bundling phase, esbuild is not configured with any extension
      // search of its own, so we need to do it. (During the scanning phase, all
      // of vite's resolver is plugged into esbuild, which *does* already handle
      // the resolvable extensions.)
      if (this.phase === 'bundling') {
        for (let ext of extensions) {
          yield specifier + ext;
        }
      }
    }
  }

  async defaultResolve(): Promise<Resolution<OnResolveResult, OnResolveResult>> {
    const request = this;
    if (request.isVirtual) {
      return {
        type: 'found',
        filename: request.specifier,
        result: { path: request.specifier, namespace: 'embroider-virtual' },
        isVirtual: this.isVirtual,
      };
    }
    if (request.isNotFound) {
      // todo: make sure this looks correct to users
      return {
        type: 'not_found',
        err: {
          errors: [{ text: `module not found ${request.specifier}` }],
        },
      };
    }

    let firstResult: ResolveResult | undefined;

    for (let requestName of this.extensionSearch(request.specifier)) {
      requestStatus(requestName);

      let result = await this.context.resolve(requestName, {
        importer: request.fromFile,
        resolveDir: dirname(request.fromFile),
        kind: this.kind,
        pluginData: {
          embroider: {
            enableCustomResolver: false,
            meta: request.meta,
          },
        },
      });

      let status = readStatus(requestName);

      if (result.errors.length > 0 || status === 'not_found') {
        if (!firstResult) {
          // if extension search fails, we want to let the first failure be the
          // one that propagates, so that the error message makes sense.
          firstResult = result;
        }
        // let extension search continue
      } else if (result.external) {
        return { type: 'ignored', result };
      } else {
        if (this.phase === 'bundling') {
          // we need to ensure that we don't traverse back into the app while
          // doing dependency pre-bundling. There are multiple ways an addon can
          // resolve things from the app, due to the existince of both app-js
          // (modules in addons that are logically part of the app's namespace)
          // and non-strict handlebars (which resolves
          // components/helpers/modifiers against the app's global pool).
          let pkg = this.packageCache.ownerOfFile(result.path);
          if (pkg?.root === this.packageCache.appRoot) {
            let externalizedName = requestName;
            if (!packageName(externalizedName)) {
              // the request was a relative path. This won't remain valid once
              // it has been bundled into vite/deps. But we know it targets the
              // app, so we can always convert it into a non-relative import
              // from the app's namespace
              //
              // IMPORTANT: whenever an addon resolves a relative path to the
              // app, it does so because our code in the core resolver has
              // rewritten the request to be relative to the app's root. So here
              // we will only ever encounter relative paths that are already
              // relative to the app's root directory.
              externalizedName = externalName(pkg.packageJSON, externalizedName) || externalizedName;
            }
            return {
              type: 'ignored',
              result: {
                path: externalizedName,
                external: true,
              },
            };
          }
        }
        return { type: 'found', filename: result.path, result, isVirtual: this.isVirtual };
      }
    }

    // cast is safe because we know extensionSearch always yields >0 entries
    return { type: 'not_found', err: firstResult! };
  }
}

/*
  This is an unfortunate necessity. During depscan, vite deliberately hides
  information from esbuild. Specifically, it treats "not found" and "this is an
  external dependency" as both "external: true". But we really care about the
  difference, since we have fallback behaviors for the "not found" case. Using
  this global state, our rollup resolver plugin can observe what vite is
  actually doing and communicate that knowledge outward to our esbuild resolver
  plugin.
 */
function sharedGlobalState() {
  let channel = (globalThis as any).__embroider_vite_resolver_channel__ as
    | undefined
    | Map<string, 'pending' | 'found' | 'not_found'>;
  if (!channel) {
    channel = new Map();
    (globalThis as any).__embroider_vite_resolver_channel__ = channel;
  }
  return channel;
}

function requestStatus(id: string): void {
  sharedGlobalState().set(id, 'pending');
}

export function writeStatus(id: string, status: 'found' | 'not_found'): void {
  let channel = sharedGlobalState();
  if (channel.get(id) === 'pending') {
    channel.set(id, status);
  }
}

function readStatus(id: string): 'pending' | 'not_found' | 'found' {
  let channel = sharedGlobalState();
  let result = channel.get(id) ?? 'pending';
  channel.delete(id);
  return result;
}
