import 'qunit';
import { allBabelVersions, emberTemplateCompilerPath } from '@embroider/test-support';
import { join } from 'path';
import TemplateCompiler from '../src/template-compiler';
import sampleTransform from '@embroider/sample-transforms/lib/glimmer-plugin';

const { test } = QUnit;

function stage1Tests(transform: (code: string) => string) {
  test('template literal form', function(assert) {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs${'`'}<div class={{embroider-sample-transforms-target}}></div>${'`'};
      }
      `);
    assert.ok(/import hbs from 'htmlbars-inline-precompile'/.test(code), 'still has hbs import');
    assert.ok(/return hbs`<div/.test(code), 'still in hbs format');
    assert.ok(/embroider-sample-transforms-result/.test(code), 'transform ran');
  });
  test('call form', function(assert) {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div class={{embroider-sample-transforms-target}}></div>");
      }
      `);
    assert.ok(/import hbs from 'htmlbars-inline-precompile'/.test(code), 'still has hbs import');
    assert.ok(/return hbs\("<div/.test(code), 'still in hbs format');
    assert.ok(/embroider-sample-transforms-result/.test(code), 'transform ran');
  });
}

function stage3Tests(transform: (code: string) => string) {
  test('tagged template literal form', function(assert) {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs${'`'}<div class={{embroider-sample-transforms-target}}></div>${'`'};
      }
      `);
    assert.ok(!/import hbs from 'htmlbars-inline-precompile'/.test(code), 'hbs import stripped');
    assert.ok(/return Ember.HTMLBars.template\({/.test(code), 'no longer in hbs format');
  });
  test('call form', function(assert) {
    let code = transform(`
      import hbs from 'htmlbars-inline-precompile';
      export default function() {
        return hbs("<div class={{embroider-sample-transforms-target}}></div>");
      }
      `);
    assert.ok(!/import hbs from 'htmlbars-inline-precompile'/.test(code), 'hbs import stripped');
    assert.ok(/return Ember.HTMLBars.template\({/.test(code), 'no longer in hbs format');
  });
}

QUnit.module('inline-hbs', function() {
  QUnit.module('stage1', function () {
    allBabelVersions({
      babelConfig() {
        let templateCompiler = new TemplateCompiler({
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: [sampleTransform]
          },
        });
        return {
          plugins: [
            [join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 1 }]
          ]
        };
      },
      createTests: stage1Tests
    });
  });

  QUnit.module('stage3 no presets', function() {
    allBabelVersions({
      babelConfig() {
        let templateCompiler = new TemplateCompiler({
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: []
          },
        });
        return {
          plugins: [
            [join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 3 }]
          ]
        };
      },
      createTests: stage3Tests
    });
  });

  QUnit.module('stage3 with presets', function() {
    allBabelVersions({
      babelConfig(major: number) {
        let templateCompiler = new TemplateCompiler({
          compilerPath: emberTemplateCompilerPath(),
          EmberENV: {},
          plugins: {
            ast: []
          },
        });
        return {
          plugins: [
            [join(__dirname, '../src/babel-plugin-inline-hbs.js'), { templateCompiler, stage: 3 }]
          ],
          presets: [
            [require.resolve(major === 6 ? 'babel-preset-env' : '@babel/preset-env'), {
              modules: false,
              targets: {
                ie: '11.0.0'
              }
            }]
          ]
        };
      },
      createTests: stage3Tests
    });
  });
});
