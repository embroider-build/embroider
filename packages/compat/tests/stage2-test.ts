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
import { TemplateCompiler } from '@embroider/core';
import Options from '../src/options';

QUnit.module('stage2 build', function() {
  QUnit.module('static with rules', function(origHooks) {

    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;
    let app: Project;
    let transpile: (contents: string, file: BoundFileAssert) => string;

    hooks.before(async function(assert) {
      app = emberProject();
      (app.files.app as Project["files"]).templates = {
        'index.hbs': `
          <HelloWorld @useDynamic="first-choice" />
          <HelloWorld @useDynamic={{"secondchoice"}} />
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
        addonDependencyRules: [{
          name: 'my-addon',
          modules: {
            './templates/components/hello-world.hbs': {
              dynamicComponentSources: {
                dynamicComponentName: { fromArgument: 'useDynamic' }
              }
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
        } else {
          return contents;
        }
      };
    });

    hooks.after(async function() {
      await app.dispose();
      await builder.cleanup();
    });

    test.skip('index.hbs', function(assert) {
      let assertFile = assert.file('templates/index.hbs').transform(transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/third-choice\.hbs["']/, 'static component helper dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
      assertFile.matches(/import \w+ from ["'].\/components\/second-choice\.hbs["']/, 'rule-driven mustache string literal');
    });

    test.skip('curly.hbs', function(assert) {
      let assertFile = assert.file('templates/curly.hbs').transform(transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/third-choice\.hbs["']/, 'static component helper dependency');
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
    });

  });

});
