import type { ModuleRequest, Resolution } from '@embroider/core';
import { cleanUrl, getUrlQueryParams } from '@embroider/core';
import type { PluginContext, ResolveIdResult } from 'rollup';

export const virtualPrefix = 'embroider_virtual:';

// TODO: Query params should be bundler-specific and not be sent to the
// bundler-agnostic part of Embroider (e.g. Vite-specific ?direct param)
// However, Fastboot currently relies on the ?names query param, so this
// constant is used as a quick fix to keep the query param when requesting
// Fastboot-related virtual content.
export const fastbootQueryParam = 'names';

export class RollupModuleRequest implements ModuleRequest {
  static from(
    context: PluginContext,
    source: string,
    importer: string | undefined,
    custom: Record<string, any> | undefined
  ): RollupModuleRequest | undefined {
    if (!(custom?.embroider?.enableCustomResolver ?? true)) {
      return;
    }
    if (custom?.depScan) {
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
      let cleanSource = cleanUrl(source, true);
      let queryParams = getUrlQueryParams(source, true);

      return new RollupModuleRequest(
        context,
        cleanSource,
        fromFile,
        custom?.embroider?.meta,
        false,
        undefined,
        queryParams,
        importerQueryParams
      );
    }
  }

  private constructor(
    private context: PluginContext,
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isNotFound: boolean,
    readonly resolvedTo: Resolution<ResolveIdResult> | undefined,
    private queryParams: string,
    private importerQueryParams: string
  ) {}

  get debugType() {
    return 'rollup';
  }

  get isVirtual(): boolean {
    return this.specifier.startsWith(virtualPrefix);
  }

  private get specifierWithQueryParams(): string {
    return `${this.specifier}${this.queryParams}`;
  }

  private get fromFileWithQueryParams(): string {
    return `${this.fromFile}${this.importerQueryParams}`;
  }

  alias(newSpecifier: string) {
    return new RollupModuleRequest(
      this.context,
      newSpecifier,
      this.fromFile,
      this.meta,
      false,
      undefined,
      this.queryParams,
      this.importerQueryParams
    ) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new RollupModuleRequest(
        this.context,
        this.specifier,
        newFromFile,
        this.meta,
        false,
        undefined,
        this.queryParams,
        this.importerQueryParams
      ) as this;
    }
  }
  virtualize(filename: string) {
    return new RollupModuleRequest(
      this.context,
      virtualPrefix + filename,
      this.fromFile,
      this.meta,
      false,
      undefined,
      this.queryParams,
      this.importerQueryParams
    ) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new RollupModuleRequest(
      this.context,
      this.specifier,
      this.fromFile,
      meta,
      this.isNotFound,
      this.resolvedTo,
      this.queryParams,
      this.importerQueryParams
    ) as this;
  }
  notFound(): this {
    return new RollupModuleRequest(
      this.context,
      this.specifier,
      this.fromFile,
      this.meta,
      true,
      undefined,
      this.queryParams,
      this.importerQueryParams
    ) as this;
  }
  async defaultResolve(): Promise<Resolution<ResolveIdResult>> {
    if (this.isVirtual) {
      return {
        type: 'found',
        filename: this.specifier,
        result: { id: this.specifierWithQueryParams, resolvedBy: this.fromFileWithQueryParams },
        isVirtual: this.isVirtual,
      };
    }
    if (this.isNotFound) {
      // TODO: we can make sure this looks correct in rollup & vite output when a
      // user encounters it
      let err = new Error(`module not found ${this.specifierWithQueryParams}`);
      (err as any).code = 'MODULE_NOT_FOUND';
      return { type: 'not_found', err };
    }
    let result = await this.context.resolve(this.specifierWithQueryParams, this.fromFileWithQueryParams, {
      skipSelf: true,
      custom: {
        embroider: {
          enableCustomResolver: false,
          meta: this.meta,
        },
      },
    });
    if (result) {
      // strip Vite-specific query params but keep FastBoot ones
      let { pathname, searchParams } = new URL(result.id, 'http://example.com');
      let filename = searchParams.get(fastbootQueryParam) ? result.id : pathname;
      return { type: 'found', filename, result, isVirtual: this.isVirtual };
    } else {
      return { type: 'not_found', err: undefined };
    }
  }

  resolveTo(resolution: Resolution<ResolveIdResult>): this {
    return new RollupModuleRequest(
      this.context,
      this.specifier,
      this.fromFile,
      this.meta,
      this.isNotFound,
      resolution,
      this.queryParams,
      this.importerQueryParams
    ) as this;
  }
}
