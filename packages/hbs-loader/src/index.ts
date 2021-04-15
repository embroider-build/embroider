import { getOptions } from 'loader-utils';
import { applyVariantToTemplateCompiler, Variant } from '@embroider/core';

export interface HbsLoaderConfig {
  variant: Variant;
  templateCompilerFile: string;
}

// workaround for https://github.com/webpack/webpack/issues/11630
type LoaderContext = any;

export default function hbsLoader(this: LoaderContext, templateContent: string) {
  let { templateCompilerFile, variant } = (getOptions(this) as unknown) as HbsLoaderConfig;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let templateCompiler = applyVariantToTemplateCompiler(variant, require(templateCompilerFile)).compile;

  try {
    return templateCompiler(this.resourcePath, templateContent);
  } catch (error) {
    error.type = 'Template Compiler Error';
    error.file = this.resourcePath;
    this.emitError(error);
    return '';
  }
}
