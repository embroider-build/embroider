import { virtualContent } from '@embroider/core';
import { LoaderContext } from 'webpack';

export default function virtualLoader(this: LoaderContext<unknown>) {
  if (typeof this.query === 'string' && this.query[0] === '?') {
    let filename = this.query.slice(1);
    this.resourcePath = filename;
    return virtualContent(filename);
  }
  throw new Error(`@embroider/webpack/src/virtual-loader received unexpected request: ${this.query}`);
}
