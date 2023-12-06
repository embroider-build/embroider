import { dirname, resolve } from 'path';
import type { ModuleRequest, ResolverFunction, Resolution } from '@embroider/core';
import { Resolver as EmbroiderResolver, ResolverOptions as EmbroiderResolverOptions } from '@embroider/core';
import type { Compiler, Module, ResolveData } from 'webpack';
import assertNever from 'assert-never';
import escapeRegExp from 'escape-string-regexp';

export { EmbroiderResolverOptions as Options };

const virtualLoaderName = '@embroider/webpack/src/virtual-loader';
const virtualLoaderPath = resolve(__dirname, './virtual-loader.js');
const virtualRequestPattern = new RegExp(`${escapeRegExp(virtualLoaderPath)}\\?(?<query>.+)!`);

export class EmbroiderPlugin {
  #resolver: EmbroiderResolver;
  #babelLoaderPrefix: string;
  #appRoot: string;

  constructor(opts: EmbroiderResolverOptions, babelLoaderPrefix: string) {
    this.#resolver = new EmbroiderResolver(opts);
    this.#babelLoaderPrefix = babelLoaderPrefix;
    this.#appRoot = opts.appRoot;
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
      let adaptedResolve = getAdaptedResolve(defaultResolve);

      nmf.hooks.resolve.tapAsync(
        { name: '@embroider/webpack', stage: 50 },
        (state: ExtendedResolveData, callback: CB) => {
          let request = WebpackModuleRequest.from(state, this.#babelLoaderPrefix, this.#appRoot);
          if (!request) {
            defaultResolve(state, callback);
            return;
          }

          this.#resolver.resolve(request, adaptedResolve).then(
            resolution => {
              switch (resolution.type) {
                case 'not_found':
                  callback(resolution.err);
                  break;
                case 'found':
                  callback(null, resolution.result);
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

type CB = (err: null | Error, result?: Module | undefined) => void;
type DefaultResolve = (state: unknown, callback: CB) => void;

// Despite being absolutely riddled with way-too-powerful tap points,
// webpack still doesn't succeed in making it possible to provide a
// fallback to the default resolve hook in the NormalModuleFactory. So
// instead we will find the default behavior and call it from our own tap,
// giving us a chance to handle its failures.
function getDefaultResolveHook(taps: { name: string; fn: Function }[]): DefaultResolve {
  let { fn } = taps.find(t => t.name === 'NormalModuleFactory')!;
  return fn as DefaultResolve;
}

// This converts the raw function we got out of webpack into the right interface
// for use by @embroider/core's resolver.
function getAdaptedResolve(
  defaultResolve: DefaultResolve
): ResolverFunction<WebpackModuleRequest, Resolution<Module, null | Error>> {
  return function (request: WebpackModuleRequest): Promise<Resolution<Module, null | Error>> {
    return new Promise(resolve => {
      defaultResolve(request.toWebpackResolveData(), (err, value) => {
        if (err) {
          // unfortunately webpack doesn't let us distinguish between Not Found
          // and other unexpected exceptions here.
          resolve({ type: 'not_found', err });
        } else {
          resolve({ type: 'found', result: value! });
        }
      });
    });
  };
}

type ExtendedResolveData = ResolveData & {
  contextInfo: ResolveData['contextInfo'] & { _embroiderMeta?: Record<string, any> };
};

class WebpackModuleRequest implements ModuleRequest {
  static from(
    state: ExtendedResolveData,
    babelLoaderPrefix: string,
    appRoot: string
  ): WebpackModuleRequest | undefined {
    let specifier = state.request;
    if (
      specifier.includes(virtualLoaderName) || // prevents recursion on requests we have already sent to our virtual loader
      specifier.startsWith('!') // ignores internal webpack resolvers
    ) {
      return;
    }

    let fromFile: string | undefined;
    if (state.contextInfo.issuer) {
      fromFile = state.contextInfo.issuer;
    } else {
      // when the files emitted from our virtual-loader try to import things,
      // those requests show in webpack as having no issuer. But we can see here
      // which requests they are and adjust the issuer so they resolve things from
      // the correct logical place.
      for (let dep of state.dependencies) {
        let match = virtualRequestPattern.exec((dep as any)._parentModule?.userRequest);
        if (match) {
          fromFile = new URLSearchParams(match.groups!.query).get('f')!;
          break;
        }
      }
    }
    if (!fromFile) {
      return;
    }

    return new WebpackModuleRequest(
      babelLoaderPrefix,
      appRoot,
      specifier,
      fromFile,
      state.contextInfo._embroiderMeta,
      false,
      state
    );
  }

  constructor(
    private babelLoaderPrefix: string,
    private appRoot: string,
    readonly specifier: string,
    readonly fromFile: string,
    readonly meta: Record<string, any> | undefined,
    readonly isVirtual: boolean,
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
  toWebpackResolveData(): ExtendedResolveData {
    this.originalState.request = this.specifier;
    this.originalState.context = dirname(this.fromFile);
    this.originalState.contextInfo.issuer = this.fromFile;
    this.originalState.contextInfo._embroiderMeta = this.meta;
    return this.originalState;
  }

  alias(newSpecifier: string) {
    if (newSpecifier === this.specifier) {
      return this;
    }
    return new WebpackModuleRequest(
      this.babelLoaderPrefix,
      this.appRoot,
      newSpecifier,
      this.fromFile,
      this.meta,
      this.isVirtual,
      this.originalState
    ) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    }
    return new WebpackModuleRequest(
      this.babelLoaderPrefix,
      this.appRoot,
      this.specifier,
      newFromFile,
      this.meta,
      this.isVirtual,
      this.originalState
    ) as this;
  }
  virtualize(filename: string) {
    let params = new URLSearchParams();
    params.set('f', filename);
    params.set('a', this.appRoot);
    return new WebpackModuleRequest(
      this.babelLoaderPrefix,
      this.appRoot,
      `${this.babelLoaderPrefix}${virtualLoaderName}?${params.toString()}!`,
      this.fromFile,
      this.meta,
      true,
      this.originalState
    ) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new WebpackModuleRequest(
      this.babelLoaderPrefix,
      this.appRoot,
      this.specifier,
      this.fromFile,
      meta,
      this.isVirtual,
      this.originalState
    ) as this;
  }
}
