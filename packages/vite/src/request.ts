import type { ModuleRequest } from '@embroider/core';
import { cleanUrl } from '@embroider/core';

export const virtualPrefix = 'embroider_virtual:';

export class RollupModuleRequest implements ModuleRequest {
  static from(
    source: string,
    importer: string | undefined,
    custom: Record<string, any> | undefined
  ): RollupModuleRequest | undefined {
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
      return new RollupModuleRequest(source, fromFile, custom?.embroider?.meta, false);
    }
  }

  private constructor(
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isNotFound: boolean
  ) {}

  get debugType() {
    return 'rollup';
  }

  get isVirtual(): boolean {
    return this.specifier.startsWith(virtualPrefix);
  }

  alias(newSpecifier: string) {
    return new RollupModuleRequest(newSpecifier, this.fromFile, this.meta, false) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new RollupModuleRequest(this.specifier, newFromFile, this.meta, false) as this;
    }
  }
  virtualize(filename: string) {
    return new RollupModuleRequest(virtualPrefix + filename, this.fromFile, this.meta, false) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new RollupModuleRequest(this.specifier, this.fromFile, meta, this.isNotFound) as this;
  }
  notFound(): this {
    return new RollupModuleRequest(this.specifier, this.fromFile, this.meta, true) as this;
  }
}
