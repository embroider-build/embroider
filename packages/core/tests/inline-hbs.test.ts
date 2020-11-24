import { allBabelVersions, emberTemplateCompilerPath } from '@embroider/test-support';
import { join } from 'path';
import { TemplateCompilerParams } from '../src/template-compiler';
import sampleTransform from '@embroider/sample-transforms/lib/glimmer-plugin';

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
    expect(code).toMatch(/return Ember.HTMLBars.template\({/);
  });
  test('call form', () => {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div class={{embroider-sample-transforms-target}}></div>");
      }
      `);
    expect(code).not.toMatch(/import hbs from 'htmlbars-inline-precompile'/);
    expect(code).toMatch(/return Ember.HTMLBars.template\({/);
  });
}

describe('inline-hbs', () => {
  describe('stage1', () => {
    allBabelVersions({
      babelConfig() {
        let templateCompiler: TemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: [sampleTransform],
          },
        };
        return {
          plugins: [[join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 1 }]],
        };
      },
      createTests: stage1Tests,
    });
  });

  describe('stage3 no presets', () => {
    allBabelVersions({
      babelConfig() {
        let templateCompiler: TemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: [],
          },
        };
        return {
          plugins: [[join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 3 }]],
        };
      },
      createTests: stage3Tests,
    });
  });

  describe('stage3 with presets', () => {
    allBabelVersions({
      babelConfig(major: number) {
        let templateCompiler: TemplateCompilerParams = {
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: [],
          },
        };
        return {
          plugins: [[join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 3 }]],
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
