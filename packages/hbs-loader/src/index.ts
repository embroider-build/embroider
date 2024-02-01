import type { LoaderContext } from 'webpack';
import { hbsToJS } from '@embroider/core';

export interface Options {
  compatModuleNaming?: {
    rootDir: string;
    modulePrefix: string;
  };
}

export default function hbsLoader(this: LoaderContext<Options>, templateContent: string): string | undefined {
  let { compatModuleNaming } = this.getOptions();
  try {
    return hbsToJS(templateContent, { filename: this.resourcePath, compatModuleNaming });
  } catch (error) {
    error.type = 'Template Compiler Error';
    error.file = this.resourcePath;
    this.emitError(error);
    return '';
  }
}
