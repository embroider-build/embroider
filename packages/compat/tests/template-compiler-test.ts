import 'qunit';
import { removeSync, mkdtempSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { join, dirname } from 'path';
import Options, { optionsWithDefaults } from '../src/options';
import sortBy from 'lodash/sortBy';
import { tmpdir } from 'os';
import { TemplateCompiler, expectWarning } from '@embroider/core';
import { emberTemplateCompilerPath } from '@embroider/test-support';
import Resolver from '../src/resolver';

const { test } = QUnit;
const compilerPath = emberTemplateCompilerPath();

QUnit.module('template-compiler', function(hooks) {
  let appDir: string;
  let assertWarning: (pattern: RegExp, fn: () => void) => void;

  function configure(options: Options) {
    let EmberENV = {};
    let plugins = { ast: [] };
    appDir = mkdtempSync(join(tmpdir(), 'embroider-compat-tests-'));
    let resolver = new Resolver({
      root: appDir,
      modulePrefix: 'the-app',
      options: optionsWithDefaults(options)
    });
    let compiler = new TemplateCompiler({ compilerPath, resolver, EmberENV, plugins });
    return function(relativePath: string, contents: string) {
      let moduleName = givenFile(relativePath);
      let { dependencies } = compiler.precompile(moduleName, contents);
      return sortBy(dependencies, d => d.runtimeName);
    };
  }

  hooks.beforeEach(function(assert) {
    assertWarning =function(pattern: RegExp, fn: () => void) {
      assert.ok(expectWarning(pattern, fn), `expected to get a warning matching ${pattern}`);
    };
  });

  hooks.afterEach(function() {
    if (appDir) {
      removeSync(appDir);
    }
  });

  function givenFile(filename: string) {
    let target = join(appDir, filename);
    ensureDirSync(dirname(target));
    writeFileSync(target, '');
    return target;
  }

  test('emits no components when staticComponents is off', function(assert) {
    let findDependencies = configure({ staticComponents: false });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}} <HelloWorld />`),
      []
    );
  });

  test('bare dasherized component, js only', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('bare dasherized component, hbs only', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('templates/components/hello-world.hbs');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}}`),
      [
        {
          "path": "./components/hello-world.hbs",
          "runtimeName": "the-app/templates/components/hello-world"
        }
      ]
    );
  });

  test('bare dasherized component, js and hbs', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }, {
          "path": "./components/hello-world.hbs",
          "runtimeName": "the-app/templates/components/hello-world"
        }
      ]
    );
  });

  test('coalesces repeated components', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}}{{hello-world}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('tolerates non path mustaches', function(assert) {
    let findDependencies = configure({ staticComponents: false, staticHelpers: true });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<Thing @foo={{1}} />`),
      []
    );
  });

  test('block form curly component', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#hello-world}} {{/hello-world}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('block form angle component', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<HelloWorld></HelloWorld>`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('curly contextual component', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#hello-world as |h|}} {{h.title flavor="chocolate"}} {{/hello-world}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('angle contextual component, upper', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<HelloWorld as |H|> <H.title @flavor="chocolate" /> </HelloWorld>`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('angle contextual component, lower', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<HelloWorld as |h|> <h.title @flavor="chocolate" /> </HelloWorld>`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('optional component missing in mustache', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true, optionalComponents: ['this-one'] });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{this-one x=true}}`),
      []
    );
  });

  test('optional component missing in mustache block', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true, optionalComponents: ['this-one'] });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#this-one}} {{/this-one}}`),
      []
    );
  });

  test('optional component missing in element', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true, optionalComponents: ['this-one'] });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<ThisOne/>`),
      []
    );
  });

  test('mustache missing, no args', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{hello-world}}`),
      []
    );
  });

  test('mustache missing, with args', function(assert) {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    assert.throws(() => {
      findDependencies('templates/application.hbs', `{{hello-world foo=bar}}`);
    }, new RegExp(`Missing component or helper hello-world in ${appDir}/templates/application.hbs`));
  });

  test('string literal passed to component helper in content position', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{component "hello-world"}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('string literal passed to component helper with block', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#component "hello-world"}} {{/component}}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }
      ]
    );
  });

  test('string literal passed to component helper in helper position', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('components/my-thing.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        },
        {
          "path": "../components/my-thing.js",
          "runtimeName": "the-app/components/my-thing"
        }
      ]
    );
  });

  test('string literal passed to component helper fails to resolve', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/my-thing.js');
    assert.throws(() => {
      findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`);
    }, new RegExp(`Missing component hello-world in templates/application.hb`));
  });

  test('string literal passed to component helper fails to resolve when staticComponents is off', function(assert) {
    let findDependencies = configure({ staticComponents: false });
    givenFile('components/my-thing.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`),
      []
    );
  });

  test('dynamic component helper warning in content position', function() {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    assertWarning(/ignoring dynamic component this\.which/, () => {
      findDependencies('templates/application.hbs', `{{component this.which}}`);
    });
  });

  test('angle component, js and hbs', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<HelloWorld />`),
      [
        {
          "path": "../components/hello-world.js",
          "runtimeName": "the-app/components/hello-world"
        }, {
          "path": "./components/hello-world.hbs",
          "runtimeName": "the-app/templates/components/hello-world"
        }
      ]
    );
  });

  test('angle component missing', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    assert.throws(() => {
      findDependencies('templates/application.hbs', `<HelloWorld />`);
    }, new RegExp(`Missing component HelloWorld in ${appDir}/templates/application.hbs`));
  });

  test('helper in subexpression', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`),
      [
        {
          runtimeName: 'the-app/helpers/array',
          path: '../helpers/array.js',
        }
      ]
    );
  });

  test('missing subexpression with args', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    assert.throws(() => {
      findDependencies('templates/application.hbs', `{{#each (things 1 2 3) as |num|}} {{num}} {{/each}}`);
    }, new RegExp(`Missing helper things in ${appDir}/templates/application.hbs`));
  });

  test('missing subexpression no args', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    assert.throws(() => {
      findDependencies('templates/application.hbs', `{{#each (things) as |num|}} {{num}} {{/each}}`);
    }, new RegExp(`Missing helper things in ${appDir}/templates/application.hbs`));
  });

  test('emits no helpers when staticHelpers is off', function(assert) {
    let findDependencies = configure({ staticHelpers: false });
    givenFile('helpers/array.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`),
      []
    );
  });

  test('helper as component argument', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{my-component value=(array 1 2 3) }}`),
      [
        {
          runtimeName: 'the-app/helpers/array',
          path: '../helpers/array.js',
        }
      ]
    );
  });

  test('helper as html attribute', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<div data-foo={{capitalize name}}></div>`),
      [
        {
          runtimeName: 'the-app/helpers/capitalize',
          path: '../helpers/capitalize.js',
        }
      ]
    );
  });

  test('helper in bare mustache, no args', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{capitalize}}`),
      [
        {
          runtimeName: 'the-app/helpers/capitalize',
          path: '../helpers/capitalize.js',
        }
      ]
    );
  });

  test('helper in bare mustache, with args', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{capitalize name}}`),
      [
        {
          runtimeName: 'the-app/helpers/capitalize',
          path: '../helpers/capitalize.js',
        }
      ]
    );
  });

  test('local binding takes precedence over helper in bare mustache', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each things as |capitalize|}} {{capitalize}} {{/each}}`),
      []
    );
  });

  test('local binding takes precedence over component in element position', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('components/the-thing.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each things as |TheThing|}} <TheThing /> {{/each}}`),
      []
    );
  });

  test('angle components can establish local bindings', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<Outer as |capitalize|> {{capitalize}} </Outer>`),
      []
    );
  });

  test('local binding only applies within block', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each things as |capitalize|}} {{capitalize}} {{/each}} {{capitalize}}`),
      [
        {
          runtimeName: 'the-app/helpers/capitalize',
          path: '../helpers/capitalize.js',
        }
      ]
    );
  });

  test('ignores builtins', function(assert) {
    let findDependencies = configure({ staticHelpers: true, staticComponents: true });
    assert.deepEqual(
      findDependencies('templates/application.hbs', `
        {{outlet "foo"}}
        {{yield bar}}
        {{#with (hash submit=(action doit)) as |thing| }}
        {{/with}}
      `),
      []
    );
  });

});
