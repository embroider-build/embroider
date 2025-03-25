import core from '@embroider/core';
const { cleanUrl, packageName } = core;
import type { ImportKind, OnResolveResult, PluginBuild } from 'esbuild';
import { dirname } from 'path';

import type {
  PackageCachePublicAPI as PackageCache,
  Resolution,
  ModuleRequest,
  RequestAdapter,
  VirtualResponse,
} from '@embroider/core';
import { externalName } from '@embroider/reverse-exports';
import type { BackChannel } from './backchannel.js';
import { assertNever } from 'assert-never';

export class EsBuildRequestAdapter implements RequestAdapter<Resolution<OnResolveResult, OnResolveResult>> {
  static create({
    packageCache,
    phase,
    build,
    kind,
    path,
    importer,
    pluginData,
    backChannel,
  }: {
    packageCache: PackageCache;
    phase: 'bundling' | 'scanning' | 'other';
    build: PluginBuild;
    kind: ImportKind;
    path: string;
    importer: string | undefined;
    pluginData: Record<string, any> | undefined;
    backChannel: BackChannel | undefined;
  }) {
    if (!(pluginData?.embroider?.enableCustomResolver ?? true)) {
      return;
    }

    if (path && importer && path[0] !== '\0' && !path.startsWith('virtual-module:')) {
      let fromFile = cleanUrl(importer);
      if (process.platform === 'win32') {
        // embroider uses real OS paths for filenames. Vite and Esbuild don't do so consistently.
        fromFile = fromFile.replace(/\//g, '\\');
      }
      return {
        initialState: {
          specifier: path,
          fromFile,
          meta: pluginData?.embroider?.meta,
        },
        adapter: new EsBuildRequestAdapter(packageCache, phase, build, kind, backChannel),
      };
    }
  }

  private constructor(
    private packageCache: PackageCache,
    private phase: 'bundling' | 'scanning' | 'other',
    private context: PluginBuild,
    private kind: ImportKind,
    private backChannel: BackChannel | undefined
  ) {}

  get debugType() {
    return 'esbuild';
  }

  notFoundResponse(
    request: ModuleRequest<Resolution<OnResolveResult, OnResolveResult>>
  ): Resolution<OnResolveResult, OnResolveResult> {
    return {
      type: 'not_found',
      err: {
        errors: [{ text: `module not found ${request.specifier}` }],
      },
    };
  }

  virtualResponse(
    _request: ModuleRequest<Resolution<OnResolveResult, OnResolveResult>>,
    virtual: VirtualResponse
  ): Resolution<OnResolveResult, OnResolveResult> {
    return {
      type: 'found',
      filename: virtual.specifier,
      result: { path: virtual.specifier, namespace: 'embroider-virtual', pluginData: { virtual } },
      virtual,
    };
  }

  async resolve(
    request: ModuleRequest<Resolution<OnResolveResult, OnResolveResult>>
  ): Promise<Resolution<OnResolveResult, OnResolveResult>> {
    if (this.backChannel) {
      this.backChannel.requestStatus(request.specifier, request.fromFile);
    }

    let result = await this.context.resolve(request.specifier, {
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

    if (result.errors.length > 0) {
      return { type: 'not_found', err: result };
    }

    let filename = result.path;

    if (this.backChannel) {
      let status = this.backChannel.readStatus(request.specifier, request.fromFile);
      switch (status.type) {
        case 'not_found':
          return { type: 'not_found', err: result };
        case 'found':
          if (result.external) {
            // when we know that the file was really found, but vite has
            // externalized it, report the true filename that was found, not the
            // externalized request path.
            filename = status.filename;
          }
          break;
        case 'indeterminate':
          break;
        default:
          throw assertNever(status);
      }
    }

    if (this.phase === 'bundling') {
      // we need to ensure that we don't traverse back into the app while
      // doing dependency pre-bundling. There are multiple ways an addon can
      // resolve things from the app, due to the existince of both app-js
      // (modules in addons that are logically part of the app's namespace)
      // and non-strict handlebars (which resolves
      // components/helpers/modifiers against the app's global pool).
      let pkg = this.packageCache.ownerOfFile(result.path);
      if (
        pkg?.root === this.packageCache.appRoot &&
        // vite provides node built-in polyfills under a custom namespace and we dont
        // want to interrupt that. We'd prefer they get bundled in the dep optimizer normally,
        // rather than getting deferred to the app build (which also works, but means they didn't
        // get pre-optimized).
        (result.namespace === 'file' || result.namespace.startsWith('embroider-'))
      ) {
        let externalizedName = request.specifier;
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
          type: 'found',
          filename: externalizedName,
          virtual: false,
          result: {
            path: externalizedName,
            external: true,
          },
        };
      }
    }

    return {
      type: 'found',
      filename,
      result,
      virtual: false,
    };
  }
}
