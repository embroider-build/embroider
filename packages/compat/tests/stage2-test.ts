import {
  emberProject,
  addAddon,
  Project
} from './helpers';
import 'qunit';
import { emberApp } from '@embroider/test-support';
import CompatAddons from '../src/compat-addons';
import App from '../src/compat-app';
import { Builder } from 'broccoli';
import { installFileAssertions, BoundFileAssert } from './file-assertions';
import { join } from 'path';
import { TemplateCompiler, throwOnWarnings } from '@embroider/core';
import Options from '../src/options';
import { TransformOptions, transform } from '@babel/core';

QUnit.module('stage2 build', function() {
  QUnit.module('static with rules', function(origHooks) {

    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;
    let app: Project;
    let transpile: (contents: string, file: BoundFileAssert) => string;

    throwOnWarnings(hooks);

    hooks.before(async function(assert) {
      app = emberProject();
      (app.files.app as Project["files"]).templates = {
        'index.hbs': `
          <HelloWorld @useDynamic="first-choice" />
          <HelloWorld @useDynamic={{"second-choice"}} />
          <HelloWorld @useDynamic={{component "third-choice"}} />
        `,
        'curly.hbs': `
          {{hello-world useDynamic="first-choice" }}
          {{hello-world useDynamic=(component "third-choice") }}
        `,
        components: {
          'first-choice.hbs': 'first',
          'second-choice.hbs': 'second',
          'third-choice.hbs': 'third',
        }
      };

      let addon = addAddon(app, 'my-addon');
      addon.files.addon = {
        components: {
          'hello-world.js': `
            import Component from '@ember/component';
            import layout from '../templates/components/hello-world';
            import computed from '@ember/object/computed';
            export default Component.extend({
              dynamicComponentName: computed('useDynamic', function() {
                return this.useDynamic || 'default-dynamic';
              }),
              layout
            });
          `,
        },
        templates: {
          components: {
            'hello-world.hbs': `
              {{component dynamicComponentName}}
            `,
          }
        }
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
        }
      };
      app.writeSync();
      let legacyAppInstance = emberApp(app.baseDir, { tests: false });
      let options: Options = {
        staticComponents: true,
        staticHelpers: true,
        packageRules: [{
          package: 'my-addon',
          components: {
            '{{hello-world}}': {
              acceptsComponentArguments: [{
                name: 'useDynamic',
                becomes: 'dynamicComponentName',
              }],
              layout: {
                addonPath: 'templates/components/hello-world.hbs'
              }
            }
          },
          addonModules: {
            'components/hello-world.js': {
              dependsOnModules: [ './synthetic-import-1' ],
              dependsOnComponents: ['{{second-choice}}'],
            }
          },
          appModules: {
            'components/hello-world.js': {
              dependsOnModules: [ './synthetic-import-2' ]
            }
          }
        }]
      };
      let compatApp = new App(legacyAppInstance, new CompatAddons(legacyAppInstance, options), options);
      builder = new Builder(compatApp.tree);
      await builder.build();
      assert.basePath = (await compatApp.ready()).outputPath;
      transpile = (contents: string, fileAssert: BoundFileAssert) => {
        if (fileAssert.path.endsWith('.hbs')) {
          let templateCompiler = require(join(fileAssert.basePath, '_template_compiler_')) as TemplateCompiler;
          return templateCompiler.compile(fileAssert.fullPath, contents);
        } else if (fileAssert.path.endsWith('.js')) {
          let babelConfig = require(join(fileAssert.basePath, '_babel_config_')).config as TransformOptions;
          return transform(contents, Object.assign({ filename: fileAssert.fullPath}, babelConfig))!.code!;
        } else {
          return contents;
        }
      };
    });

    hooks.after(async function() {
      await app.dispose();
      await builder.cleanup();
    });

    test('index.hbs', function(assert) {
      let assertFile = assert.file('templates/index.hbs').transform(transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/third-choice\.hbs["']/, 'static component helper dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
      assertFile.matches(/import \w+ from ["'].\/components\/second-choice\.hbs["']/, 'rule-driven mustache string literal');
    });

    test('curly.hbs', function(assert) {
      let assertFile = assert.file('templates/curly.hbs').transform(transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/third-choice\.hbs["']/, 'static component helper dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
    });

    test('hello-world.hbs', function(assert) {
      // the point of this test is to ensure that we can transpile with no
      // warning about the dynamicComponentName.
      let assertFile = assert.file('node_modules/my-addon/templates/components/hello-world.hbs').transform(transpile);

      // this is a pretty trivial test, but it's needed to force the
      // transpilation to happen because transform() is lazy.
      assertFile.matches(/dynamicComponentName/);
    });

    test('addon/hello-world.js', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/hello-world.js').transform(transpile);
      assertFile.matches(/import ["']\.\/synthetic-import-1/);
      let pattern =`import a0 from ["']${assert.basePath}\/templates\/components\/second-choice\.hbs["']`;
      assertFile.matches(new RegExp(pattern));
      pattern = `window\.define\("my-app\/templates\/components\/second-choice"`;
      assertFile.matches(new RegExp(/window\.define\(["']my-app\/templates\/components\/second-choice["']/));
    });

    test('app/hello-world.js', function(assert) {
      let assertFile = assert.file('./components/hello-world.js').transform(transpile);
      assertFile.matches(/import ["']\.\/synthetic-import-2/);
    });

  });

});
