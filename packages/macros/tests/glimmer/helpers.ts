import { emberTemplateCompiler } from '@embroider/test-support';
import { Project } from 'scenario-tester';
import { MacrosConfig } from '../../src/node';
import { join, resolve } from 'path';
import { hbsToJS } from '@embroider/shared-internals';
import { transformAsync } from '@babel/core';
import type { Options as EtcOptions, Transform } from 'babel-plugin-ember-template-compilation';

const compilerPath = emberTemplateCompiler().path;

export { Project };

type CreateTests = (
  transform: (templateContents: string, options?: TemplateTransformOptions) => Promise<string>
) => void;

export interface TemplateTransformOptions {
  /**
   * The path to the source we are transforming
   */
  filename?: string;
  /**
   * Customize the app root for this macros run.
   * Defaults to the `@embroider/macros` package directory
   */
  appRoot?: string;

  /**
   * Allow further customization of the macros config before finalization and invocation of the transform callback.
   *
   * If this option is passed you must call `config.finalize()` yourself in this callback.
   */
  configure?: (config: MacrosConfig) => void;
}

export function templateTests(createTests: CreateTests) {
  let transform = async (templateContents: string, options: TemplateTransformOptions = {}) => {
    let { plugins, setConfig } = MacrosConfig.transforms();
    let config = MacrosConfig.for({}, options.appRoot ?? resolve(__dirname, '..', '..'));
    setConfig(config);

    if (options.configure) {
      options.configure(config);
    } else {
      config.finalize();
    }

    let filename = options.filename ?? join(__dirname, 'sample.hbs');

    let etcOptions: EtcOptions = {
      compilerPath,
      transforms: plugins as Transform[],
      targetFormat: 'hbs',
    };

    let js = (await transformAsync(hbsToJS(templateContents, { filename: filename }), {
      plugins: [
        [require.resolve('babel-plugin-ember-template-compilation'), etcOptions],
        require.resolve('@babel/plugin-transform-modules-amd'),
      ],
      filename,
    }))!.code!;

    let deps: string[];
    let impl: Function;

    // this gets used by the eval below
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function define(_deps: string[], _impl: Function) {
      deps = _deps;
      impl = _impl;
    }

    eval(js);
    let hbs: string | undefined;
    impl!(
      ...deps!.map(d => {
        switch (d) {
          case 'exports':
            return {};
          case '@ember/template-compilation':
            return {
              precompileTemplate(theHBS: string) {
                hbs = theHBS;
              },
            };
          default:
            throw new Error(`unexpected dependency ${d}`);
        }
      })
    );
    return hbs ?? `no hbs found`;
  };

  createTests(transform);
}
