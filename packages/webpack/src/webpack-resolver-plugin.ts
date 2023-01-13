import { dirname } from 'path';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import {
  Resolver as EmbroiderResolver,
  ResolverOptions as EmbroiderResolverOptions,
  Resolution,
} from '@embroider/core';
import type { Compiler, Resolver as WebpackResolver } from 'webpack';
import assertNever from 'assert-never';

export { EmbroiderResolverOptions as Options };

export class EmbroiderPlugin {
  constructor(private opts: EmbroiderResolverOptions) {}
  apply(compiler: Compiler) {
    if (!compiler.options.resolve.plugins) {
      compiler.options.resolve.plugins = [];
    }

    let vfs = compiler.options.plugins.find((i: unknown) => i instanceof VirtualModulesPlugin) as
      | VirtualModulesPlugin
      | undefined;

    if (!vfs) {
      vfs = new VirtualModulesPlugin();
      compiler.options.plugins.push(vfs);
    }

    let resolverPlugin = new ResolverPlugin(vfs, this.opts);
    compiler.options.resolve.plugins.push(resolverPlugin);
  }
}

class ResolverPlugin {
  private resolver: EmbroiderResolver;

  constructor(private vfs: VirtualModulesPlugin, opts: EmbroiderResolverOptions) {
    this.resolver = new EmbroiderResolver(opts);
  }

  #resolve(
    resolution: Resolution,
    resolver: WebpackResolver,
    request: Request,
    context: unknown,
    callback: (err?: Error | null, result?: any) => void
  ) {
    if (resolution.result === 'virtual') {
      this.vfs.writeModule(`node_modules/${resolution.filename}`, resolution.content);
      resolution = {
        result: 'alias',
        specifier: resolution.filename,
      };
    }

    switch (resolution.result) {
      case 'alias': {
        let newRequest = {
          request: resolution.specifier,
          path: resolution.fromFile ? dirname(resolution.fromFile) : request.path,
          fullySpecified: false,
          context: {
            issuer: resolution.fromFile ?? request.context.issuer,
          },
        };
        resolver.doResolve(
          resolver.ensureHook('internal-resolve'),
          newRequest,
          '@embroider/webpack',
          context,
          wrapCallback(callback)
        );
        return;
      }
      case 'rehome': {
        let newRequest = {
          request: request.request,
          path: dirname(resolution.fromFile),
          fullySpecified: false,
          context: {
            issuer: resolution.fromFile,
          },
        };
        resolver.doResolve(
          resolver.ensureHook('internal-resolve'),
          newRequest,
          '@embroider/webpack',
          context,
          wrapCallback(callback)
        );
        return;
      }
      case 'continue':
        return;
      default:
        throw assertNever(resolution);
    }
  }

  apply(resolver: WebpackResolver) {
    // raw-resolve -> internal-resolve is the same place in the pipeline that
    // webpack's built-in `resolve.alias` takes effect. It's supposed to take
    // precedence over other resolving decisions.
    resolver.getHook('raw-resolve').tapAsync('my-resolver-plugin', async (request, context, callback) => {
      if (!isRelevantRequest(request)) {
        return callback();
      }
      let result = this.resolver.beforeResolve(request.request, request.context.issuer);
      this.#resolve(result, resolver, request, context, callback);
    });

    // described-resolve -> internal-resolve is the same place in the pipeline
    // that webpack's built-in `resolve.fallback` takes effect. It's supposed to
    // only run when the rest of resolving fails to find something.
    resolver.getHook('described-resolve').tapAsync(
      // we need to set the stage here because otherwise we end up before the
      // built-in NextPlugin. Instead we want to behave like the built-in
      // AliasPlugin that implements resolve.fallback -- it comes after
      // NextPlugin.
      //
      // The number just needs to be greater than zero to come after the
      // defaults (tapable assigned them stage 0 by default).
      { name: 'my-resolver-plugin', stage: 10 },
      async (request, context, callback) => {
        if (!isRelevantRequest(request)) {
          return callback();
        }
        let result = this.resolver.fallbackResolve(request.request, request.context.issuer);
        this.#resolve(result, resolver, request, context, callback);
      }
    );
  }
}

interface Request {
  request: string;
  path: string;
  context: {
    issuer: string;
  };
}

function isRelevantRequest(request: any): request is Request {
  return (
    typeof request.request === 'string' &&
    typeof request.context?.issuer === 'string' &&
    request.context.issuer !== '' &&
    typeof request.path === 'string'
  );
}

function wrapCallback<T>(callback: (err?: Error | null, result?: T) => void) {
  return (err: Error | null, result: T) => {
    if (err) return callback(err);
    if (result) return callback(null, result);
    return callback();
  };
}
