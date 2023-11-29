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
      return new RollupModuleRequest(source, fromFile, custom?.embroider?.meta);
    }
  }

  private constructor(
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined
  ) {}

  get isVirtual(): boolean {
    return this.specifier.startsWith(virtualPrefix);
  }

  alias(newSpecifier: string) {
    return new RollupModuleRequest(newSpecifier, this.fromFile, this.meta) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new RollupModuleRequest(this.specifier, newFromFile, this.meta) as this;
    }
  }
  virtualize(filename: string) {
    return new RollupModuleRequest(virtualPrefix + filename, this.fromFile, this.meta) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new RollupModuleRequest(this.specifier, this.fromFile, meta) as this;
  }
}
