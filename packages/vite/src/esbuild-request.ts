import { type ModuleRequest, cleanUrl } from '@embroider/core';
import type { ImportKind, OnResolveResult, PluginBuild } from 'esbuild';
import { dirname } from 'path';

import type { Resolution } from '@embroider/core';

export class EsBuildModuleRequest implements ModuleRequest {
  static from(
    context: PluginBuild,
    kind: ImportKind,
    source: string,
    importer: string | undefined,
    pluginData: Record<string, any> | undefined
  ): EsBuildModuleRequest | undefined {
    if (!(pluginData?.embroider?.enableCustomResolver ?? true)) {
      return;
    }

    if (source && importer && source[0] !== '\0' && !source.startsWith('virtual-module:')) {
      let fromFile = cleanUrl(importer);
      return new EsBuildModuleRequest(
        context,
        kind,
        source,
        fromFile,
        pluginData?.embroider?.meta,
        false,
        false,
        undefined
      );
    }
  }

  private constructor(
    private context: PluginBuild,
    private kind: ImportKind,
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isVirtual: boolean,
    readonly isNotFound: boolean,
    readonly resolvedTo: Resolution<OnResolveResult, OnResolveResult> | undefined
  ) {}

  get debugType() {
    return 'esbuild';
  }

  alias(newSpecifier: string) {
    return new EsBuildModuleRequest(
      this.context,
      this.kind,
      newSpecifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      false,
      undefined
    ) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      return new EsBuildModuleRequest(
        this.context,
        this.kind,
        this.specifier,
        newFromFile,
        this.meta,
        this.isVirtual,
        false,
        undefined
      ) as this;
    }
  }
  virtualize(filename: string) {
    return new EsBuildModuleRequest(
      this.context,
      this.kind,
      filename,
      this.fromFile,
      this.meta,
      true,
      false,
      undefined
    ) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new EsBuildModuleRequest(
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      meta,
      this.isVirtual,
      this.isNotFound,
      this.resolvedTo
    ) as this;
  }
  notFound(): this {
    return new EsBuildModuleRequest(
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      true,
      undefined
    ) as this;
  }

  resolveTo(resolution: Resolution<OnResolveResult, OnResolveResult>): this {
    return new EsBuildModuleRequest(
      this.context,
      this.kind,
      this.specifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      this.isNotFound,
      resolution
    ) as this;
  }

  async defaultResolve(): Promise<Resolution<OnResolveResult, OnResolveResult>> {
    const request = this;
    if (request.isVirtual) {
      return {
        type: 'found',
        filename: request.specifier,
        result: { path: request.specifier, namespace: 'embroider-virtual' },
        isVirtual: this.isVirtual,
      };
    }
    if (request.isNotFound) {
      // todo: make sure this looks correct to users
      return {
        type: 'not_found',
        err: {
          errors: [{ text: `module not found ${request.specifier}` }],
        },
      };
    }

    requestStatus(request.specifier);

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

    let status = readStatus(request.specifier);

    if (result.errors.length > 0 || status === 'not_found') {
      return { type: 'not_found', err: result };
    } else if (result.external) {
      return { type: 'ignored', result };
    } else {
      return { type: 'found', filename: result.path, result, isVirtual: this.isVirtual };
    }
  }
}

/*
  This is an unfortunate necessity. During depscan, vite deliberately hides
  information from esbuild. Specifically, it treats "not found" and "this is an
  external dependency" as both "external: true". But we really care about the
  difference, since we have fallback behaviors for the "not found" case. Using
  this global state, our rollup resolver plugin can observe what vite is
  actually doing and communicate that knowledge outward to our esbuild resolver
  plugin.
 */
function sharedGlobalState() {
  let channel = (globalThis as any).__embroider_vite_resolver_channel__ as
    | undefined
    | Map<string, 'pending' | 'found' | 'not_found'>;
  if (!channel) {
    channel = new Map();
    (globalThis as any).__embroider_vite_resolver_channel__ = channel;
  }
  return channel;
}

function requestStatus(id: string): void {
  sharedGlobalState().set(id, 'pending');
}

export function writeStatus(id: string, status: 'found' | 'not_found'): void {
  let channel = sharedGlobalState();
  if (channel.get(id) === 'pending') {
    channel.set(id, status);
  }
}

function readStatus(id: string): 'pending' | 'not_found' | 'found' {
  let channel = sharedGlobalState();
  let result = channel.get(id) ?? 'pending';
  channel.delete(id);
  return result;
}
