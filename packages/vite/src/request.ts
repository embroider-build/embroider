import type { ModuleRequest, Resolution, Package, PackageCache as _PackageCache } from '@embroider/core';
import core from '@embroider/core';
const { cleanUrl, getUrlQueryParams, locateEmbroiderWorkingDir, packageName } = core;
import type { PluginContext, ResolveIdResult } from 'rollup';
import { resolve } from 'path';

type PublicAPI<T> = { [K in keyof T]: T[K] };
type PackageCache = PublicAPI<_PackageCache>;

export const virtualPrefix = 'embroider_virtual:';

export class RollupModuleRequest implements ModuleRequest {
  static from(
    packageCache: PackageCache,
    context: PluginContext,
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
      let importerQueryParams = getUrlQueryParams(nonVirtual);

      // strip query params off the source but keep track of them
      // we use regexp-based methods over a URL object because the
      // source can be a relative path.
      let cleanSource = cleanUrl(source);
      let queryParams = getUrlQueryParams(source);

      return new RollupModuleRequest(
        packageCache,
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
    public packageCache: PackageCache,
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
      this.packageCache,
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
        this.packageCache,
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
      this.packageCache,
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
      this.packageCache,
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
      this.packageCache,
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
    let resolvable = makeResolvable(this.packageCache, this.fromFile, this.specifier);
    let r = this.alias(resolvable.specifier).rehome(resolvable.fromFile);
    let result = await this.context.resolve(r.specifierWithQueryParams, r.fromFileWithQueryParams, {
      skipSelf: true,
      custom: {
        embroider: {
          enableCustomResolver: false,
          meta: this.meta,
        },
      },
    });
    if (result) {
      let { pathname } = new URL(result.id, 'http://example.com');
      return { type: 'found', filename: pathname, result, isVirtual: this.isVirtual };
    } else {
      return { type: 'not_found', err: undefined };
    }
  }

  resolveTo(resolution: Resolution<ResolveIdResult>): this {
    return new RollupModuleRequest(
      this.packageCache,
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

/**
 * For Vite to correctly detect and optimize dependencies the request must have the following conditions
 * 1. specifier must be a bare import
 * 2. specifier must be node resolvable without any plugins
 * 3. importer must not be in node_modules
 *
 * this functions changes the request for rewritten addons such that they are resolvable from app root
 */
export function makeResolvable(
  packageCache: PackageCache,
  fromFile: string,
  specifier: string
): { fromFile: string; specifier: string } {
  if (fromFile.startsWith('@embroider/rewritten-packages')) {
    let workingDir = locateEmbroiderWorkingDir(process.cwd());
    const rewrittenRoot = resolve(workingDir, 'rewritten-packages');
    fromFile = fromFile.replace('@embroider/rewritten-packages', rewrittenRoot);
  }
  if (fromFile && !fromFile.startsWith('./')) {
    let fromPkg: Package;
    try {
      fromPkg = packageCache.ownerOfFile(fromFile) || packageCache.ownerOfFile(process.cwd())!;
    } catch (e) {
      fromPkg = packageCache.ownerOfFile(process.cwd())!;
    }

    if (!fromPkg.isV2App()) {
      return { fromFile, specifier };
    }

    let pkgName = packageName(specifier);
    try {
      let pkg = pkgName ? packageCache.resolve(pkgName, fromPkg!) : fromPkg;
      if (!pkg.isV2Addon() || !pkg.meta['auto-upgraded'] || !pkg.root.includes('rewritten-packages')) {
        // some tests make addons be auto-upgraded, but are not actually in rewritten-packages
        return { fromFile, specifier };
      }
      let levels = ['..'];
      if (pkg.name.startsWith('@')) {
        levels.push('..');
      }
      let resolvedRoot = resolve(pkg.root, ...levels, ...levels, '..');
      if (specifier.startsWith(pkg.name)) {
        specifier = resolve(pkg.root, ...levels, specifier);
      }
      specifier = specifier.replace(resolvedRoot, '@embroider/rewritten-packages').replace(/\\/g, '/');
      return {
        specifier,
        fromFile: resolve(process.cwd(), 'package.json'),
      };
    } catch (e) {}
  }
  return { fromFile, specifier };
}
