import { ResolverLoader, virtualContent, type VirtualResponse } from '@embroider/core';
import type { LoaderContext } from 'webpack';

let resolverLoader: ResolverLoader | undefined;

function setup(appRoot: string): ResolverLoader {
  if (resolverLoader?.appRoot !== appRoot) {
    resolverLoader = new ResolverLoader(appRoot);
  }
  return resolverLoader;
}

export default function virtualLoader(this: LoaderContext<unknown>): string | undefined {
  if (typeof this.query === 'string' && this.query[0] === '?') {
    let params = new URLSearchParams(this.query);
    let filename = params.get('f');
    let appRoot = params.get('a');
    if (!filename || !appRoot) {
      throw new Error(`bug in @embroider/webpack virtual loader, cannot locate params in ${this.query}`);
    }
    let { resolver } = setup(appRoot);
    this.resourcePath = filename;
    // @ts-expect-error unimplemented
    let virtual: VirtualResponse = fixmeImplementVirtualResponse();
    return virtualContent(virtual, resolver).src;
  }
  throw new Error(`@embroider/webpack/src/virtual-loader received unexpected request: ${this.query}`);
}
