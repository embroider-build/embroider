import { dirname, resolve } from 'path';
import { ModuleRequest, type VirtualResponse, type RequestAdapter, type Resolution } from '@embroider/core';
import { ResolverLoader } from '@embroider/core';
import type { Resolver as EmbroiderResolver, ResolverOptions } from '@embroider/core';
import type { Compiler, Module, ResolveData } from 'webpack';
import assertNever from 'assert-never';
import escapeRegExp from 'escape-string-regexp';
import { registerVirtualResponse } from './virtual-loader';

export type { ResolverOptions as Options };

const virtualLoaderName = '@embroider/webpack/src/virtual-loader';
const virtualLoaderPath = resolve(__dirname, './virtual-loader.js');
const virtualRequestPattern = new RegExp(`${escapeRegExp(virtualLoaderPath)}\\?(?<query>.+)!`);

export class EmbroiderPlugin {
  #resolverLoader: ResolverLoader;
  #babelLoaderPrefix: string;
  #appRoot: string;

  // Note: the resolver config (resolver.json) is read lazily, the first time
  // webpack actually resolves something. That's important because the compat
  // prebuild (which writes resolver.json) runs during the build, after this
  // plugin has already been constructed and `apply`'d.
  constructor(appRoot: string, babelLoaderPrefix: string) {
    this.#resolverLoader = new ResolverLoader(appRoot);
    this.#babelLoaderPrefix = babelLoaderPrefix;
    this.#appRoot = appRoot;
  }

  get #resolver(): EmbroiderResolver {
    return this.#resolverLoader.resolver;
  }

  #addLoaderAlias(compiler: Compiler, name: string, alias: string) {
    let { resolveLoader } = compiler.options;
    if (Array.isArray(resolveLoader.alias)) {
      resolveLoader.alias.push({ name, alias });
    } else if (resolveLoader.alias) {
      resolveLoader.alias[name] = alias;
    } else {
      resolveLoader.alias = {
        [name]: alias,
      };
    }
  }

  apply(compiler: Compiler) {
    this.#addLoaderAlias(compiler, virtualLoaderName, virtualLoaderPath);

    compiler.hooks.normalModuleFactory.tap('@embroider/webpack', nmf => {
      let defaultResolve = getDefaultResolveHook(nmf.hooks.resolve.taps);

      nmf.hooks.resolve.tapAsync(
        { name: '@embroider/webpack', stage: 50 },
        (state: ExtendedResolveData, callback: CB) => {
          let request = ModuleRequest.create(WebpackRequestAdapter.create, {
            resolveFunction: defaultResolve,
            state,
            babelLoaderPrefix: this.#babelLoaderPrefix,
            appRoot: this.#appRoot,
          });
          if (!request) {
            defaultResolve(state, callback);
            return;
          }

          this.#resolver.resolve(request).then(
            resolution => {
              switch (resolution.type) {
                case 'not_found':
                  callback(resolution.err);
                  break;
                case 'found':
                  callback(null, undefined);
                  break;
                default:
                  throw assertNever(resolution);
              }
            },
            err => callback(err)
          );
        }
      );
    });
  }
}

interface CB {
  (err: null, result: Module | undefined): void;
  (err: Error | null): void;
}
type DefaultResolve = (state: ResolveData, callback: CB) => void;

// Despite being absolutely riddled with way-too-powerful tap points,
// webpack still doesn't succeed in making it possible to provide a
// fallback to the default resolve hook in the NormalModuleFactory. So
// instead we will find the default behavior and call it from our own tap,
// giving us a chance to handle its failures.
function getDefaultResolveHook(taps: { name: string; fn: Function }[]): DefaultResolve {
  let { fn } = taps.find(t => t.name === 'NormalModuleFactory')!;
  return fn as DefaultResolve;
}

type ExtendedResolveData = ResolveData & {
  contextInfo: ResolveData['contextInfo'] & { _embroiderMeta?: Record<string, any> };
};

type WebpackResolution = Resolution<ResolveData['createData'], null | Error>;

class WebpackRequestAdapter implements RequestAdapter<WebpackResolution> {
  static create({
    resolveFunction,
    state,
    babelLoaderPrefix,
    appRoot,
  }: {
    resolveFunction: DefaultResolve;
    state: ExtendedResolveData;
    babelLoaderPrefix: string;
    appRoot: string;
  }) {
    let specifier = state.request;
    if (
      specifier.includes(virtualLoaderName) || // prevents recursion on requests we have already sent to our virtual loader
      specifier.startsWith('!') // ignores internal webpack resolvers
    ) {
      return;
    }

    if (specifier.startsWith('/@embroider/virtual/')) {
      // when our virtual paths are used in HTML (and the generated entries we
      // derive from it) they come in with a leading slash. We still want them
      // to resolve like packages, exactly as the vite/rollup adapter does.
      specifier = specifier.slice(1);
    }

    let fromFile: string | undefined;
    if (state.contextInfo.issuer) {
      fromFile = state.contextInfo.issuer;
    } else {
      // when the files emitted from our virtual-loader try to import things,
      // those requests show in webpack as having no issuer. But we can see here
      // which requests they are and adjust the issuer so they resolve things from
      // the correct logical place. The virtual module's own specifier is the
      // correct logical "fromFile" for any imports it makes.
      for (let dep of state.dependencies) {
        let match = virtualRequestPattern.exec((dep as any)._parentModule?.userRequest);
        if (match) {
          // URLSearchParams already decodes the value
          let id = new URLSearchParams(match.groups!.query).get('id');
          if (id) {
            fromFile = id;
            break;
          }
        }
      }
    }
    if (!fromFile) {
      return;
    }

    return {
      initialState: {
        specifier,
        fromFile,
        meta: state.contextInfo._embroiderMeta,
      },
      adapter: new WebpackRequestAdapter(resolveFunction, babelLoaderPrefix, appRoot, state),
    };
  }

  private constructor(
    private resolveFunction: DefaultResolve,
    private babelLoaderPrefix: string,
    private appRoot: string,
    private originalState: ExtendedResolveData
  ) {}

  get debugType() {
    return 'webpack';
  }

  // Webpack mostly relies on mutation to adjust requests. We could create a
  // whole new ResolveData instead, and that would allow defaultResolving to
  // happen, but for the output of that process to actually affect the
  // downstream code in Webpack we would still need to mutate the original
  // ResolveData with the results (primarily the `createData`). So since we
  // cannot avoid the mutation anyway, it seems best to do it earlier rather
  // than later, so that everything from here forward is "normal".
  //
  // Technically a NormalModuleLoader `resolve` hook *can* directly return a
  // Module, but that is not how the stock one works, and it would force us to
  // copy more of Webpack's default behaviors into the inside of our hook. Like,
  // we would need to invoke afterResolve, createModule, createModuleClass, etc,
  // just like webpack does if we wanted to produce a Module directly.
  //
  // So the mutation strategy is much less intrusive, even though it means there
  // is the risk of state leakage all over the place.
  //
  // We mitigate that risk by waiting until the last possible moment to apply
  // our desired ModuleRequest fields to the ResolveData. This means that as
  // requests evolve through the module-resolver they aren't actually all
  // mutating the shared state. Only when a request is allowed to bubble back
  // out to webpack does that happen.
  toWebpackResolveData(
    request: ModuleRequest<WebpackResolution>,
    virtual: VirtualResponse | false
  ): ExtendedResolveData {
    let specifier = request.specifier;
    if (virtual) {
      // Hand the VirtualResponse across in-process and key the request only by
      // the stable specifier, so the same logical virtual always produces the
      // same webpack module (this is what rollup/vite get for free).
      registerVirtualResponse(this.appRoot, virtual);
      let params = new URLSearchParams();
      params.set('id', virtual.specifier);
      params.set('a', this.appRoot);
      specifier = `${this.babelLoaderPrefix}${virtualLoaderName}?${params.toString()}!`;
    }

    this.originalState.request = specifier;
    this.originalState.context = dirname(request.fromFile);
    this.originalState.contextInfo.issuer = request.fromFile;
    this.originalState.contextInfo._embroiderMeta = request.meta;
    if (request.resolvedTo && typeof request.resolvedTo !== 'function') {
      if (request.resolvedTo.type === 'found') {
        this.originalState.createData = request.resolvedTo.result;
      }
    }
    return this.originalState;
  }

  notFoundResponse(request: ModuleRequest<WebpackResolution>): WebpackResolution {
    let err = new Error(`module not found ${request.specifier}`);
    (err as any).code = 'MODULE_NOT_FOUND';
    return { type: 'not_found', err };
  }

  virtualResponse(
    request: ModuleRequest<WebpackResolution>,
    virtual: VirtualResponse
  ): () => Promise<WebpackResolution> {
    return () => {
      return this._resolve(request, virtual);
    };
  }

  async resolve(request: ModuleRequest<WebpackResolution>): Promise<WebpackResolution> {
    return this._resolve(request, false);
  }

  async _resolve(
    request: ModuleRequest<WebpackResolution>,
    virtualResponse: VirtualResponse | false
  ): Promise<WebpackResolution> {
    return await new Promise(resolve =>
      this.resolveFunction(this.toWebpackResolveData(request, virtualResponse), err => {
        if (err) {
          // unfortunately webpack doesn't let us distinguish between Not Found
          // and other unexpected exceptions here.
          resolve({ type: 'not_found', err });
        } else {
          resolve({
            type: 'found',
            result: this.originalState.createData,
            virtual: virtualResponse,
            filename: this.originalState.createData.resource!,
          });
        }
      })
    );
  }
}
