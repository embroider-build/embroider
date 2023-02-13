import { dirname, resolve } from 'path';
import {
  Resolver as EmbroiderResolver,
  ResolverOptions as EmbroiderResolverOptions,
  ModuleRequest,
  ResolverFunction,
  Resolution,
} from '@embroider/core';
import type { Compiler, Module } from 'webpack';
import assertNever from 'assert-never';

export { EmbroiderResolverOptions as Options };

const virtualLoaderName = '@embroider/webpack/src/virtual-loader';

export class EmbroiderPlugin {
  #resolver: EmbroiderResolver;

  constructor(opts: EmbroiderResolverOptions) {
    this.#resolver = new EmbroiderResolver(opts);
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
    this.#addLoaderAlias(compiler, virtualLoaderName, resolve(__dirname, './virtual-loader'));

    compiler.hooks.normalModuleFactory.tap('@embroider/webpack', nmf => {
      let defaultResolve = getDefaultResolveHook(nmf.hooks.resolve.taps);
      let adaptedResolve = getAdaptedResolve(defaultResolve);

      nmf.hooks.resolve.tapAsync({ name: '@embroider/webpack', stage: 50 }, (state: unknown, callback: CB) => {
        let request = WebpackModuleRequest.from(state);
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
  specifier: string;
  fromFile: string;

  static from(state: any): WebpackModuleRequest | undefined {
    if (
      typeof state.request === 'string' &&
      typeof state.context === 'string' &&
      typeof state.contextInfo?.issuer === 'string' &&
      state.contextInfo.issuer !== '' &&
      !state.request.startsWith(virtualLoaderName) // prevents recursion on requests we have already sent to our virtual loader
    ) {
      return new WebpackModuleRequest(state);
    }
  }

  constructor(
    public state: {
      request: string;
      context: string;
      contextInfo: {
        issuer: string;
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
  }

  alias(newSpecifier: string) {
    this.state.request = newSpecifier;
    return new WebpackModuleRequest(this.state) as this;
  }
  rehome(newFromFile: string) {
    this.state.contextInfo.issuer = newFromFile;
    this.state.context = dirname(newFromFile);
    return new WebpackModuleRequest(this.state) as this;
  }
  virtualize(filename: string) {
    this.state.request = `${virtualLoaderName}?${filename}!`;
    return new WebpackModuleRequest(this.state, true) as this;
  }
}
