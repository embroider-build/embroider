import make from '@embroider/core/src/babel-plugin-stage1-inline-hbs';
import { TemplateCompiler, TemplateCompilerParams } from '@embroider/core';
import { getEmberExports } from '@embroider/core/src/load-ember-template-compiler';
import { EmberENV } from '@embroider/core';

type TemplateTransform = () => { name: string; visitor: {} };

export type TemplateTransformPlugin = TemplateTransform | string;
export interface Options {
  astTransforms: TemplateTransformPlugin[] | undefined;
  compilerPath: string;
  EmberENV: EmberENV;
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
  let { compilerPath, astTransforms: somePlugins = [], ...opts } = options;
  const astTransforms: TemplateTransform[] = resolvePlugins(somePlugins);

  const params: TemplateCompilerParams = {
    loadEmberTemplateCompiler: () => getEmberExports(compilerPath),
    plugins: {
      ast: astTransforms,
    },
    ...opts,
  };

  return new TemplateCompiler(params);
});
