import { allBabelVersions, emberTemplateCompilerPath } from '@embroider/test-support';
import { join } from 'path';
import { NodeTemplateCompilerParams } from '../src/template-compiler-node';
import sampleTransform from '@embroider/sample-transforms/lib/glimmer-plugin';
import type { Params as InlineBabelParams } from '../src/babel-plugin-inline-hbs-node';

function stage1Tests(transform: (code: string) => string) {
  test('template literal form', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs${'`'}<div class={{embroider-sample-transforms-target}}></div>${'`'};
      }
      `);
    expect(code).toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/return hbs`<div/);
    expect(code).toMatch(/embroider-sample-transforms-result/);
  });
  test('call form', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div class={{embroider-sample-transforms-target}}></div>");
      }
      `);
    expect(code).toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/return hbs\("<div/);
    expect(code).toMatch(/embroider-sample-transforms-result/);
  });

  test('runtime errors are left in place in stage 1', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div>", { insertRuntimeErrors: true });
      }
      `);
    expect(code).toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/return hbs\("<div>",\s*\{\s*insertRuntimeErrors: true\s*\}\)/);
  });
}

function stage3Tests(transform: (code: string) => string) {
  test('tagged template literal form', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs${'`'}<div class={{embroider-sample-transforms-target}}></div>${'`'};
      }
      `);
    expect(code).not.toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/import { createTemplateFactory } from ['"]@ember\/template-factory['"]/);
    expect(code).toMatch(/return createTemplateFactory\({/);
  });
  test('call form', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div class={{embroider-sample-transforms-target}}></div>");
      }
      `);
    expect(code).not.toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/import { createTemplateFactory } from ['"]@ember\/template-factory['"]/);
    expect(code).toMatch(/return createTemplateFactory\({/);
  });
  test('runtime errors become exceptions in stage 3', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div>", { insertRuntimeErrors: true });
      }
      `);
    expect(code).not.toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).not.toMatch(/import { createTemplateFactory } from ['"]@ember\/template-factory['"]/);
    expect(code).toMatch(/throw new Error\("Unclosed element `div`/);
  });
}

describe('inline-hbs', () => {
  describe('stage1', () => {
    allBabelVersions({
      babelConfig() {
        let templateCompiler: NodeTemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          compilerChecksum: `mock-compiler-checksum${Math.random()}`,
          EmberENV: {},
          plugins: {
            ast: [sampleTransform],
          },
        };
        return {
          plugins: [
            [
              join(__dirname, '../src/babel-plugin-inline-hbs-node.js'),
              { templateCompiler, stage: 1 } as InlineBabelParams,
            ],
          ],
        };
      },
      createTests: stage1Tests,
    });
  });

  describe('stage3 no presets', () => {
    allBabelVersions({
      babelConfig() {
        let templateCompiler: NodeTemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          compilerChecksum: `mock-compiler-checksum${Math.random()}`,
          EmberENV: {},
          plugins: {
            ast: [],
          },
        };
        return {
          plugins: [
            [
              join(__dirname, '../src/babel-plugin-inline-hbs-node.js'),
              { templateCompiler, stage: 3, needsModulesPolyfill: true } as InlineBabelParams,
            ],
          ],
        };
      },
      createTests: stage3Tests,
    });
  });

  describe('stage3 with presets', () => {
    allBabelVersions({
      babelConfig(major: number) {
        let templateCompiler: NodeTemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          compilerChecksum: `mock-compiler-checksum${Math.random()}`,
          EmberENV: {},
          plugins: {
            ast: [],
          },
        };
        return {
          plugins: [
            [
              join(__dirname, '../src/babel-plugin-inline-hbs-node.js'),
              { templateCompiler, stage: 3, needsModulesPolyfill: true } as InlineBabelParams,
            ],
          ],
          presets: [
            [
              require.resolve(major === 6 ? 'babel-preset-env' : '@babel/preset-env'),
              {
                modules: false,
                targets: {
                  ie: '11.0.0',
                },
              },
            ],
          ],
        };
      },
      createTests: stage3Tests,
    });
  });
});
