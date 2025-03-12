import type { ModuleRequest, RequestAdapter, RequestAdapterCreate, Resolution, VirtualResponse } from '@embroider/core';
import core from '@embroider/core';
import { resolve } from 'path';

const { cleanUrl, getUrlQueryParams } = core;
import type { PluginContext, ResolveIdResult } from 'rollup';

interface Init {
  context: PluginContext;
  source: string;
  importer: string | undefined;
  custom: Record<string, any> | undefined;
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
        adapter: new RollupRequestAdapter(context, queryParams, importerQueryParams),
      };
    }
  };

  private constructor(
    private context: PluginContext,
    private queryParams: string,
    private importerQueryParams: string
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
    let result = await this.context.resolve(
      this.specifierWithQueryParams(request.specifier),
      this.fromFileWithQueryParams(request.fromFile),
      {
        skipSelf: true,
        custom: {
          embroider: {
            enableCustomResolver: false,
            meta: request.meta,
          },
        },
      }
    );
    if (result) {
      let { pathname } = new URL(result.id, 'http://example.com');
      return { type: 'found', filename: pathname, result, virtual: false };
    } else {
      return { type: 'not_found', err: undefined };
    }
  }
}
