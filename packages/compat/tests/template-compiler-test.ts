// things in support of the tests
import 'qunit';
import { removeSync, mkdtempSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { join, dirname } from 'path';
import Options, { optionsWithDefaults } from '../src/options';
import emberTemplateCompiler from './vendor/ember-template-compiler.js';
import { Resolution } from '@embroider/core';
import sortBy from 'lodash/sortBy';

// the things under test
import Resolver from '../src/resolver';
import setupCompiler from '@embroider/core/src/template-compiler';

const { test } = QUnit;

QUnit.module('template-compiler', function(hooks) {
  let appDir: string;

  function configure(options: Options) {
    let EmberENV = {};
    let plugins = { ast: [] };
    appDir = mkdtempSync('embroider-compat-tests');
    let resolver = new Resolver({
      root: appDir,
      modulePrefix: 'the-app',
      options: optionsWithDefaults(options)
    });
    let { compile, dependenciesOf } = setupCompiler(emberTemplateCompiler, resolver, EmberENV, plugins);
    return function(relativePath: string, contents: string): Resolution[] {
      let moduleName = givenFile(relativePath);
      compile(moduleName, contents);
      return dependenciesOf(moduleName)!.map(d => {
        d.modules = sortBy(d.modules, r => r.path);
        return d;
      });
    };
  }

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
          type: 'component',
          modules: [{
            "path": "../components/hello-world.js",
            "runtimeName": "the-app/components/hello-world"
          }]
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
          type: 'component',
          modules: [{
            "path": "./components/hello-world.hbs",
            "runtimeName": "the-app/templates/components/hello-world"
          }]
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
          type: 'component',
          modules: [{
            "path": "../components/hello-world.js",
            "runtimeName": "the-app/components/hello-world"
          }, {
            "path": "./components/hello-world.hbs",
            "runtimeName": "the-app/templates/components/hello-world"
          }]
        }
      ]
    );
  });

  test('angle component component, js and hbs', function(assert) {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `<HelloWorld />`),
      [
        {
          type: 'component',
          modules: [{
            "path": "../components/hello-world.js",
            "runtimeName": "the-app/components/hello-world"
          }, {
            "path": "./components/hello-world.hbs",
            "runtimeName": "the-app/templates/components/hello-world"
          }]
        }
      ]
    );
  });

  test('helper in subexpression', function(assert) {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    assert.deepEqual(
      findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`),
      [
        {
          type: 'helper',
          modules: [{
            runtimeName: 'the-app/helpers/array',
            path: '../helpers/array.js',
          }]
        }
      ]
    );
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
          type: 'helper',
          modules: [{
            runtimeName: 'the-app/helpers/array',
            path: '../helpers/array.js',
          }]
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
          type: 'helper',
          modules: [{
            runtimeName: 'the-app/helpers/capitalize',
            path: '../helpers/capitalize.js',
          }]
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
          type: 'helper',
          modules: [{
            runtimeName: 'the-app/helpers/capitalize',
            path: '../helpers/capitalize.js',
          }]
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
          type: 'helper',
          modules: [{
            runtimeName: 'the-app/helpers/capitalize',
            path: '../helpers/capitalize.js',
          }]
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

});
