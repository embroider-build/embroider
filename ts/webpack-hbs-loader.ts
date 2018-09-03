import { getOptions } from 'loader-utils';

export default function hbsLoader(templateContent) {
  let { templateCompiler } = getOptions(this);
  try {
    return templateCompiler(this.resourcePath, templateContent);
  } catch(error) {
    error.type = 'Template Compiler Error';
    error.file = this.resourcePath;
    throw error;
  }
}
