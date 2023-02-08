import { Resolver } from '@embroider/core';
import { LoaderContext } from 'webpack';

export default function virtualLoader(this: LoaderContext<unknown>) {
  let filename = this.loaders[this.loaderIndex].options;
  if (typeof filename === 'string') {
    return Resolver.virtualContent(filename);
  }
  throw new Error(`@embroider/webpack/src/virtual-loader received unexpected request: ${filename}`);
}
