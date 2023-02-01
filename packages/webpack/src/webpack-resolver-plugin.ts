import { dirname, resolve } from 'path';
import {
  Resolver as EmbroiderResolver,
  ResolverOptions as EmbroiderResolverOptions,
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

  #handle(resolution: Resolution, state: Request) {
    switch (resolution.result) {
      case 'alias':
        state.request = resolution.specifier;
        if (resolution.fromFile) {
          state.contextInfo.issuer = resolution.fromFile;
          state.context = dirname(resolution.fromFile);
        }
        break;
      case 'rehome':
        state.contextInfo.issuer = resolution.fromFile;
        state.context = dirname(resolution.fromFile);
        break;
      case 'virtual':
        state.request = `${virtualLoaderName}?${resolution.filename}!`;
        break;
      case 'continue':
        break;
      default:
        throw assertNever(resolution);
    }
  }

  async #resolve(defaultResolve: (state: unknown) => Promise<Module>, state: unknown): Promise<Module> {
    if (isRelevantRequest(state)) {
      let resolution = await this.#resolver.beforeResolve(state.request, state.contextInfo.issuer);
      if (resolution.result !== 'continue') {
        this.#handle(resolution, state);
      }
    }
    try {
      return await defaultResolve(state);
    } catch (err) {
      if (!isRelevantRequest(state)) {
        throw err;
      }
      let resolution = await this.#resolver.fallbackResolve(state.request, state.contextInfo.issuer);
      if (resolution.result === 'continue') {
        throw err;
      } else {
        this.#handle(resolution, state);
        return await this.#resolve(defaultResolve, state);
      }
    }
  }

  apply(compiler: Compiler) {
    this.#addLoaderAlias(compiler, virtualLoaderName, resolve(__dirname, './virtual-loader'));

    compiler.hooks.normalModuleFactory.tap('my-experiment', nmf => {
      // Despite being absolutely riddled with way-too-powerful tap points,
      // webpack still doesn't succeed in making it possible to provide a
      // fallback to the default resolve hook in the NormalModuleFactory. So
      // instead we will find the default behavior and call it from our own tap,
      // giving us a chance to handle its failures.
      let { fn } = nmf.hooks.resolve.taps.find(t => t.name === 'NormalModuleFactory')!;
      let defaultResolve = fn as unknown as (state: unknown, callback: CB) => void;
      let pDefaultResolve = promisifyDefaultResolve(defaultResolve);

      nmf.hooks.resolve.tapAsync({ name: 'my-experiment', stage: 50 }, (state: unknown, callback: CB) =>
        this.#resolve(pDefaultResolve, state).then(
          result => callback(null, result),
          err => callback(err)
        )
      );
    });
  }
}

interface Request {
  request: string;
  context: string;
  contextInfo: {
    issuer: string;
  };
}

type CB = (err: Error | null, result?: Module) => void;

function promisifyDefaultResolve(defaultResolve: (state: unknown, callback: CB) => void) {
  return async function (state: unknown): Promise<Module> {
    return new Promise((resolve, reject) => {
      defaultResolve(state, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value!);
        }
      });
    });
  };
}

function isRelevantRequest(request: any): request is Request {
  return (
    typeof request.request === 'string' &&
    typeof request.context === 'string' &&
    typeof request.contextInfo?.issuer === 'string' &&
    request.contextInfo.issuer !== '' &&
    !request.request.startsWith(virtualLoaderName) // prevents recursion on requests we have already sent to our virtual loader
  );
}
