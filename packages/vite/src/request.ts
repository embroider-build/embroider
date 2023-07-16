import { ModuleRequest } from '@embroider/core';

export const virtualPrefix = 'embroider_virtual:';

export class RollupModuleRequest implements ModuleRequest {
  static from(source: string, importer: string | undefined): RollupModuleRequest | undefined {
    if (source && importer && source[0] !== '\0') {
      let nonVirtual: string;
      if (importer.startsWith(virtualPrefix)) {
        nonVirtual = importer.slice(virtualPrefix.length);
      } else {
        nonVirtual = importer;
      }

      // strip query params off the importer
      let fromFile = new URL(nonVirtual, 'http://example.com').pathname;
      return new RollupModuleRequest(source, fromFile);
    }
  }

  private constructor(readonly specifier: string, readonly fromFile: string) {}

  get isVirtual(): boolean {
    return this.specifier.startsWith(virtualPrefix);
  }

  alias(newSpecifier: string) {
    return new RollupModuleRequest(newSpecifier, this.fromFile) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new RollupModuleRequest(this.specifier, newFromFile) as this;
    }
  }
  virtualize(filename: string) {
    return new RollupModuleRequest(virtualPrefix + filename, this.fromFile) as this;
  }
}
