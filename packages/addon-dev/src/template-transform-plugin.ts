import make from '@embroider/core/src/babel-plugin-stage1-inline-hbs';
import { TemplateCompiler, TemplateCompilerParams } from '@embroider/core';
import { getEmberExports } from '@embroider/core/src/load-ember-template-compiler';

export type TemplateTransform = () => { name: string; visitor: {} };
export type TemplateTransformPlugin = TemplateTransform | string;
export interface Options {
  // An array of either Glimmer AST plugins or paths that can be resolved to a plugin.
  astTransforms?: TemplateTransformPlugin[];
  // Defaults to 'ember-source/dist/ember-template-compiler'
  compilerPath?: string;
}

function resolvePlugins(plugins: TemplateTransformPlugin[]) {
  return plugins.map((somePlugin: TemplateTransformPlugin) => {
    // If it's a string attempt to resolve the path to a module.
    return typeof somePlugin === 'string'
      ? require(somePlugin) // eslint-disable-line @typescript-eslint/no-require-imports
      : somePlugin;
  });
}

export default make((options: Options) => {
  let {
    astTransforms: somePlugins = [],
    compilerPath = 'ember-source/dist/ember-template-compiler',
  } = options;

  compilerPath = require.resolve(compilerPath);

  const astTransforms: TemplateTransform[] = resolvePlugins(somePlugins);

  const params: TemplateCompilerParams = {
    EmberENV: {},
    loadEmberTemplateCompiler: () => getEmberExports(compilerPath),
    plugins: {
      ast: astTransforms,
    },
  };

  return new TemplateCompiler(params);
});
