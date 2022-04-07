import type { LoaderContext } from 'webpack';
import { hbsToJS } from '@embroider/core';

export default function hbsLoader(this: LoaderContext<{}>, templateContent: string) {
  try {
    return hbsToJS(templateContent);
  } catch (error) {
    error.type = 'Template Compiler Error';
    error.file = this.resourcePath;
    this.emitError(error);
    return '';
  }
}
