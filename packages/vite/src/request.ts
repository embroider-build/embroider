import type { ModuleRequest, Resolution } from '@embroider/core';
import { cleanUrl } from '@embroider/core';
import type { PluginContext, ResolveIdResult } from 'rollup';

export const virtualPrefix = 'embroider_virtual:';

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
      return new RollupModuleRequest(context, source, fromFile, custom?.embroider?.meta, false, undefined);
    }
  }

  private constructor(
    private context: PluginContext,
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isNotFound: boolean,
    readonly resolvedTo: Resolution<ResolveIdResult> | undefined
  ) {}

  get debugType() {
    return 'rollup';
  }

  get isVirtual(): boolean {
    return this.specifier.startsWith(virtualPrefix);
  }

  alias(newSpecifier: string) {
    return new RollupModuleRequest(this.context, newSpecifier, this.fromFile, this.meta, false, undefined) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new RollupModuleRequest(this.context, this.specifier, newFromFile, this.meta, false, undefined) as this;
    }
  }
  virtualize(filename: string) {
    return new RollupModuleRequest(
      this.context,
      virtualPrefix + filename,
      this.fromFile,
      this.meta,
      false,
      undefined
    ) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new RollupModuleRequest(
      this.context,
      this.specifier,
      this.fromFile,
      meta,
      this.isNotFound,
      this.resolvedTo
    ) as this;
  }
  notFound(): this {
    return new RollupModuleRequest(this.context, this.specifier, this.fromFile, this.meta, true, undefined) as this;
  }
  async defaultResolve(): Promise<Resolution<ResolveIdResult>> {
    if (this.isVirtual) {
      return {
        type: 'found',
        filename: this.specifier,
        result: { id: this.specifier, resolvedBy: this.fromFile },
        isVirtual: this.isVirtual,
      };
    }
    if (this.isNotFound) {
      // TODO: we can make sure this looks correct in rollup & vite output when a
      // user encounters it
      let err = new Error(`module not found ${this.specifier}`);
      (err as any).code = 'MODULE_NOT_FOUND';
      return { type: 'not_found', err };
    }
    let result = await this.context.resolve(this.specifier, this.fromFile, {
      skipSelf: true,
      custom: {
        embroider: {
          enableCustomResolver: false,
          meta: this.meta,
        },
      },
    });
    if (result) {
      return { type: 'found', filename: result.id, result, isVirtual: this.isVirtual };
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
      resolution
    ) as this;
  }
}
