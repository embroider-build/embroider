import { PortablePluginConfig, ResolveOptions } from "./portable-plugin-config";
import { SetupCompilerParams } from "./template-compiler";
import { compile } from './js-handlebars';

const compilerTemplate = compile(`
const { PortablePluginConfig } = require('{{{js-string-escape here}}}');
const setupCompiler = require('@embroider/core/src/template-compiler').default;
module.exports = {
  compile: setupCompiler(PortablePluginConfig.load({{{json-stringify portable 2}}})).compile,
  isParallelSafe: {{ isParallelSafe }},
};
`) as (params: {
  portable: any,
  here: string,
  isParallelSafe: boolean,
}) => string;

export default class PortableTemplateCompilerConfig extends PortablePluginConfig {
  constructor(config: SetupCompilerParams, resolveOptions: ResolveOptions) {
    super(config, resolveOptions);
  }

  protected makePortable(value: any, accessPath: string[] = []) {
    if (accessPath.length === 1 && accessPath[0] === 'compilerPath') {
      return this.resolve(value);
    }
    if (accessPath.length === 1 && accessPath[0] === 'resolverPath') {
      return this.resolve(value);
    }
    return super.makePortable(value, accessPath);
  }

  serialize() {
    return compilerTemplate({ here: this.here, portable: this.portable, isParallelSafe: this.isParallelSafe });
  }
}
