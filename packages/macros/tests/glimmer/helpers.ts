import { TemplateCompiler } from '@embroider/core';
import { emberTemplateCompilerPath } from '@embroider/test-support';
import { MacrosConfig } from '../..';
import { join } from 'path';
const compilerPath = emberTemplateCompilerPath();

export function templateTests(
  createTests: (transform: (templateContents: string) => string, config?: MacrosConfig) => void
) {
  let { plugins, setConfig } = MacrosConfig.astPlugins();
  let config = MacrosConfig.for({});
  setConfig(config);
  let compiler = new TemplateCompiler({
    compilerPath,
    EmberENV: {},
    plugins: {
      ast: plugins,
    },
  });
  let transform = (templateContents: string) => {
    return compiler.applyTransforms(join(__dirname, 'sample.hbs'), templateContents);
  };
  if (createTests.length === 2) {
    createTests(transform, config);
  } else {
    config.finalize();
    createTests(transform);
  }
}
