import type { ModuleRequest, RequestAdapter, RequestAdapterCreate, Resolution } from '@embroider/core';
import core from '@embroider/core';
const { cleanUrl, getUrlQueryParams } = core;
import type { PluginContext, ResolveIdResult } from 'rollup';

export const virtualPrefix = 'embroider_virtual:';

interface Init {
  context: PluginContext;
  source: string;
  importer: string | undefined;
  custom: Record<string, any> | undefined;
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
      let nonVirtual: string;
      if (importer.startsWith(virtualPrefix)) {
        nonVirtual = importer.slice(virtualPrefix.length);
      } else {
        nonVirtual = importer;
      }

      // strip query params off the importer
      let fromFile = cleanUrl(nonVirtual);
      let importerQueryParams = getUrlQueryParams(nonVirtual);

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

  async resolve(request: ModuleRequest<Resolution<ResolveIdResult>>): Promise<Resolution<ResolveIdResult>> {
    if (request.isVirtual) {
      let specifier = virtualPrefix + request.specifier;
      return {
        type: 'found',
        filename: specifier,
        result: {
          id: this.specifierWithQueryParams(specifier),
          resolvedBy: this.fromFileWithQueryParams(request.fromFile),
        },
        isVirtual: request.isVirtual,
      };
    }
    if (request.isNotFound) {
      // TODO: we can make sure this looks correct in rollup & vite output when a
      // user encounters it
      let err = new Error(`module not found ${this.specifierWithQueryParams}`);
      (err as any).code = 'MODULE_NOT_FOUND';
      return { type: 'not_found', err };
    }
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
      return { type: 'found', filename: pathname, result, isVirtual: request.isVirtual };
    } else {
      return { type: 'not_found', err: undefined };
    }
  }
}
