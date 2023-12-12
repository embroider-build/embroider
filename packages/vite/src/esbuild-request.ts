import { type ModuleRequest, cleanUrl } from '@embroider/core';

export class EsBuildModuleRequest implements ModuleRequest {
  static from(
    source: string,
    importer: string | undefined,
    pluginData: Record<string, any> | undefined
  ): EsBuildModuleRequest | undefined {
    if (!(pluginData?.embroider?.enableCustomResolver ?? true)) {
      return;
    }

    if (source && importer && source[0] !== '\0') {
      let fromFile = cleanUrl(importer);
      return new EsBuildModuleRequest(source, fromFile, pluginData?.embroider?.meta, false, false);
    }
  }

  private constructor(
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isVirtual: boolean,
    readonly isNotFound: boolean
  ) {}

  get debugType() {
    return 'esbuild';
  }

  alias(newSpecifier: string) {
    return new EsBuildModuleRequest(newSpecifier, this.fromFile, this.meta, this.isVirtual, false) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new EsBuildModuleRequest(this.specifier, newFromFile, this.meta, this.isVirtual, false) as this;
    }
  }
  virtualize(filename: string) {
    return new EsBuildModuleRequest(filename, this.fromFile, this.meta, true, false) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new EsBuildModuleRequest(this.specifier, this.fromFile, meta, this.isVirtual, this.isNotFound) as this;
  }
  notFound(): this {
    return new EsBuildModuleRequest(this.specifier, this.fromFile, this.meta, this.isVirtual, true) as this;
  }
}
