import { dirname, resolve } from 'path';
import type { ModuleRequest, ResolverFunction, Resolution } from '@embroider/core';
import { Resolver as EmbroiderResolver, ResolverOptions as EmbroiderResolverOptions } from '@embroider/core';
import type { Compiler, Module } from 'webpack';
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

      nmf.hooks.resolve.tapAsync({ name: '@embroider/webpack', stage: 50 }, (state: unknown, callback: CB) => {
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
      });
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
      defaultResolve(request.state, (err, value) => {
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

class WebpackModuleRequest implements ModuleRequest {
  readonly specifier: string;
  readonly fromFile: string;
  readonly meta: Record<string, any> | undefined;

  static from(state: any, babelLoaderPrefix: string, appRoot: string): WebpackModuleRequest | undefined {
    // when the files emitted from our virtual-loader try to import things,
    // those requests show in webpack as having no issuer. But we can see here
    // which requests they are and adjust the issuer so they resolve things from
    // the correct logical place.
    if (!state.contextInfo?.issuer && Array.isArray(state.dependencies)) {
      for (let dep of state.dependencies) {
        let match = virtualRequestPattern.exec(dep._parentModule?.userRequest);
        if (match) {
          state.contextInfo.issuer = new URLSearchParams(match.groups!.query).get('f');
          state.context = dirname(state.contextInfo.issuer);
        }
      }
    }

    if (
      typeof state.request === 'string' &&
      typeof state.context === 'string' &&
      typeof state.contextInfo?.issuer === 'string' &&
      state.contextInfo.issuer !== '' &&
      !state.request.includes(virtualLoaderName) && // prevents recursion on requests we have already sent to our virtual loader
      !state.request.startsWith('!') // ignores internal webpack resolvers
    ) {
      return new WebpackModuleRequest(babelLoaderPrefix, appRoot, state);
    }
  }

  constructor(
    private babelLoaderPrefix: string,
    private appRoot: string,
    public state: {
      request: string;
      context: string;
      contextInfo: {
        issuer: string;
        _embroiderMeta?: Record<string, any> | undefined;
      };
    },
    public isVirtual = false
  ) {
    // these get copied here because we mutate the underlying state as we
    // convert one request into the next, and it seems better for debuggability
    // if the fields on the previous request don't change when you make a new
    // one (although it is true that only the newest one has a a valid `state`
    // that can actually be handed back to webpack)
    this.specifier = state.request;
    this.fromFile = state.contextInfo.issuer;
    this.meta = state.contextInfo._embroiderMeta ? { ...state.contextInfo._embroiderMeta } : undefined;
  }

  alias(newSpecifier: string) {
    this.state.request = newSpecifier;
    return new WebpackModuleRequest(this.babelLoaderPrefix, this.appRoot, this.state) as this;
  }
  rehome(newFromFile: string) {
    if (this.fromFile === newFromFile) {
      return this;
    } else {
      this.state.contextInfo.issuer = newFromFile;
      this.state.context = dirname(newFromFile);
      return new WebpackModuleRequest(this.babelLoaderPrefix, this.appRoot, this.state) as this;
    }
  }
  virtualize(filename: string) {
    let params = new URLSearchParams();
    params.set('f', filename);
    params.set('a', this.appRoot);
    let next = this.alias(`${this.babelLoaderPrefix}${virtualLoaderName}?${params.toString()}!`);
    next.isVirtual = true;
    return next;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    this.state.contextInfo._embroiderMeta = meta;
    return new WebpackModuleRequest(this.babelLoaderPrefix, this.appRoot, this.state) as this;
  }
}
