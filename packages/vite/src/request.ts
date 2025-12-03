import type {
  ModuleRequest,
  RequestAdapter,
  RequestAdapterCreate,
  Resolution,
  RewrittenPackageCache,
  VirtualResponse,
} from '@embroider/core';
import core from '@embroider/core';
import { resolve } from 'path';

const { cleanUrl, getUrlQueryParams, packageName } = core;
import type { PluginContext, ResolveIdResult } from 'rollup';
import type { BackChannel } from './backchannel.js';
import { assertNever } from 'assert-never';
import { externalName } from '@embroider/reverse-exports';

interface Init {
  context: PluginContext;
  source: string;
  importer: string | undefined;
  custom: Record<string, any> | undefined;
  backChannel: BackChannel | undefined;
  isDepBundling: boolean;
  packageCache: RewrittenPackageCache;
}

export interface ResponseMeta {
  virtual: VirtualResponse;
}

export class RollupRequestAdapter implements RequestAdapter<Resolution<ResolveIdResult>> {
  static create: RequestAdapterCreate<Init, Resolution<ResolveIdResult>> = ({
    context,
    source,
    importer,
    custom,
    backChannel,
    isDepBundling,
    packageCache,
  }: Init) => {
    if (!(custom?.embroider?.enableCustomResolver ?? true)) {
      return;
    }
    if (source && importer && source[0] !== '\0') {
      // strip query params off the importer
      let fromFile = cleanUrl(importer);
      if (process.platform === 'win32') {
        // embroider uses real OS paths for filenames. Vite and Esbuild don't do so consistently.
        fromFile = fromFile.replace(/\//g, '\\');
      }
      let importerQueryParams = getUrlQueryParams(importer);

      if (source.startsWith('/@embroider/virtual/')) {
        // when our virtual paths are used in HTML they come into here with a /
        // prefix. We still want them to resolve like packages.
        source = source.slice(1);
      }

      // strip query params off the source but keep track of them
      // we use regexp-based methods over a URL object because the
      // source can be a relative path.
      let cleanSource = cleanUrl(source);
      let queryParams = getUrlQueryParams(source);

      return {
        initialState: { specifier: cleanSource, fromFile, meta: custom?.embroider?.meta },
        adapter: new RollupRequestAdapter(
          context,
          queryParams,
          importerQueryParams,
          custom,
          backChannel,
          isDepBundling,
          packageCache
        ),
      };
    }
  };

  private constructor(
    private context: PluginContext,
    private queryParams: string,
    private importerQueryParams: string,
    private custom: Record<string, unknown> | undefined,
    private backChannel: BackChannel | undefined,
    private isDepBundling: boolean,
    private packageCache: RewrittenPackageCache
  ) {}

  get debugType() {
    return 'rollup';
  }

  private specifierWithQueryParams(specifier: string): string {
    return `${specifier}${this.queryParams}`;
  }

  private fromFileWithQueryParams(fromFile: string): string {
    return `${fromFile}${this.importerQueryParams}`;
  }

  virtualResponse(
    request: ModuleRequest<Resolution<ResolveIdResult>>,
    virtual: VirtualResponse
  ): Resolution<ResolveIdResult> {
    return {
      type: 'found',
      filename: virtual.specifier,
      result: {
        // The `resolve` here is necessary on windows, where we might have
        // unix-like specifiers but Vite needs to see a real windows path in the
        // result.
        id: resolve(this.specifierWithQueryParams(virtual.specifier)),
        resolvedBy: this.fromFileWithQueryParams(request.fromFile),
        meta: {
          'embroider-resolver': { virtual } satisfies ResponseMeta,
        },
      },
      virtual,
    };
  }

  notFoundResponse(_request: ModuleRequest<Resolution<ResolveIdResult>>): Resolution<ResolveIdResult> {
    let err = new Error(`module not found ${this.specifierWithQueryParams}`);
    (err as any).code = 'MODULE_NOT_FOUND';
    return { type: 'not_found', err };
  }

  async resolve(request: ModuleRequest<Resolution<ResolveIdResult>>): Promise<Resolution<ResolveIdResult>> {
    if (this.backChannel) {
      this.backChannel.requestStatus(request.specifier, request.fromFile);
    }

    let result = await this.context.resolve(
      this.specifierWithQueryParams(request.specifier),
      this.fromFileWithQueryParams(request.fromFile),
      {
        skipSelf: true,
        custom: {
          ...this.custom,
          embroider: {
            enableCustomResolver: false,
            meta: request.meta,
          },
        },
      }
    );

    if (!result) {
      return { type: 'not_found', err: undefined };
    }

    let { pathname: filename } = new URL(result.id, 'http://example.com');

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

    if (this.isDepBundling) {
      // we need to ensure that we don't traverse back into the app while
      // doing dependency pre-bundling. There are multiple ways an addon can
      // resolve things from the app, due to the existince of both app-js
      // (modules in addons that are logically part of the app's namespace)
      // and non-strict handlebars (which resolves
      // components/helpers/modifiers against the app's global pool).
      let pkg = this.packageCache.ownerOfFile(filename);
      if (pkg?.root === this.packageCache.appRoot) {
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
            id: externalizedName,
            external: true,
          },
        };
      }
    }

    return { type: 'found', filename, result, virtual: false };
  }
}
