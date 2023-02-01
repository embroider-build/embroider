import { Resolver } from '@embroider/core';
import { LoaderContext } from 'webpack';

export default function virtualLoader(this: LoaderContext<unknown>) {
  let filename = this.loaders[this.loaderIndex].options;
  if (typeof filename === 'string') {
    let content = Resolver.virtualContent(filename);
    if (content) {
      return content;
    }
  }
  throw new Error(`@embroider/webpack/src/virtual-loader received unexpected request: ${filename}`);
}
