import { applyVariantToTemplateCompiler, Variant } from '@embroider/core';
import type { LoaderContext } from 'webpack';

export interface HbsLoaderConfig {
  variant: Variant;
  templateCompilerFile: string;
}

export default function hbsLoader(this: LoaderContext<HbsLoaderConfig>, templateContent: string) {
  let { templateCompilerFile, variant } = this.getOptions();

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
