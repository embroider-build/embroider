import { TemplateCompiler } from '@embroider/core';
import { emberTemplateCompilerPath } from '@embroider/test-support';
import { MacrosConfig } from '../..';
import { join } from 'path';
const compilerPath = emberTemplateCompilerPath();

type CreateTestsWithConfig = (transform: (templateContents: string) => string, config: MacrosConfig) => void;
type CreateTests = (transform: (templateContents: string) => string) => void;

export function templateTests(createTests: CreateTestsWithConfig | CreateTests) {
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
    (createTests as CreateTestsWithConfig)(transform, config);
  } else {
    config.finalize();
    (createTests as CreateTests)(transform);
  }
}
