import { virtualContent } from '@embroider/core';
import { LoaderContext } from 'webpack';

export default function virtualLoader(this: LoaderContext<unknown>) {
  if (typeof this.query === 'string' && this.query[0] === '?') {
    return virtualContent(this.query.slice(1));
  }
  throw new Error(`@embroider/webpack/src/virtual-loader received unexpected request: ${this.query}`);
}
