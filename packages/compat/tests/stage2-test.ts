import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import Options from '../src/options';

QUnit.module('stage2 build', function() {
  QUnit.module('static with rules', function(origHooks) {
    let { hooks, test } = installFileAssertions(origHooks);
    let build: BuildResult;

    throwOnWarnings(hooks);

    hooks.before(async function(assert) {
      let app = Project.emberNew();
      app.linkPackage('@embroider/sample-transforms');
      (app.files.app as Project['files']).templates = {
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
        },
      };

      (app.files.app as Project['files']).components = {
        'uses-inline-template.js': `
        import hbs from "htmlbars-inline-precompile";
        export default Component.extend({
          layout: hbs${'`'}{{first-choice}}${'`'}
        })
        `,
      };

      (app.files.app as Project['files'])['use-deep-addon.js'] = `
      import thing from 'deep-addon';
      `;

      (app.files.app as Project['files'])['custom-babel-needed.js'] = `
        console.log('embroider-sample-transforms-target');
      `;

      let addon = app.addAddon('my-addon');
      addon.files.addon = {
        components: {
          'hello-world.js': `
            import Component from '@ember/component';
            import layout from '../templates/components/hello-world';
            import computed from '@ember/object/computed';
            import somethingExternal from 'not-a-resolvable-package';
            export default Component.extend({
              dynamicComponentName: computed('useDynamic', function() {
                return this.useDynamic || 'default-dynamic';
              }),
              layout
            });
          `,
          'has-relative-template.js': `
            import Component from '@ember/component';
            import layout from './t';
            export default Component.extend({
              layout
            });
          `,
          't.hbs': ``,
          'uses-amd-require.js': `
            export default function() {
              require('some-package');
            }
          `,
        },
        'synthetic-import-1.js': '',
        templates: {
          components: {
            'hello-world.hbs': `
              {{component dynamicComponentName}}
            `,
          },
        },
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
        },
        templates: {
          components: {
            'direct-template-reexport.js': `export { default } from 'my-addon/templates/components/hello-world';`,
          },
        },
      };

      let deepAddon = addon.addAddon('deep-addon');
      deepAddon.files.addon = {
        'index.js': '// deep-addon index',
      };

      app.addDependency('babel-filter-test1', '1.2.3').files = {
        'index.js': '',
      };

      app.addDependency('babel-filter-test2', '4.5.6').files = {
        'index.js': '',
      };

      app.addDependency('babel-filter-test3', '1.0.0').files = {
        'index.js': '',
      };

      app.addDependency('babel-filter-test4', '1.0.0').files = {
        'index.js': `
          module.exports = function() {
            return require('some-package');
          }
        `,
      };

      let options: Options = {
        staticComponents: true,
        staticHelpers: true,
        skipBabel: [
          {
            package: 'babel-filter-test1',
          },
          {
            package: 'babel-filter-test2',
            semverRange: '^4.0.0',
          },
          {
            package: 'babel-filter-test3',
            semverRange: '^2.0.0',
          },
        ],
        packageRules: [
          {
            package: 'my-addon',
            components: {
              '{{hello-world}}': {
                acceptsComponentArguments: [
                  {
                    name: 'useDynamic',
                    becomes: 'dynamicComponentName',
                  },
                ],
                layout: {
                  addonPath: 'templates/components/hello-world.hbs',
                },
              },
            },
            addonModules: {
              'components/hello-world.js': {
                dependsOnModules: ['../synthetic-import-1'],
                dependsOnComponents: ['{{second-choice}}'],
              },
            },
            appModules: {
              'components/hello-world.js': {
                dependsOnModules: ['my-addon/synthetic-import-1'],
              },
            },
          },
        ],
      };
      build = await BuildResult.build(app, {
        stage: 2,
        type: 'app',
        emberAppOptions: {
          tests: false,
        },
        embroiderOptions: options,
      });
      assert.basePath = build.outputPath;
    });

    hooks.after(async function() {
      await build.cleanup();
    });

    test('index.hbs', function(assert) {
      let assertFile = assert.file('templates/index.hbs').transform(build.transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(
        /import \w+ from ["'].\/components\/third-choice\.hbs["']/,
        'static component helper dependency'
      );
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
      assertFile.matches(
        /import \w+ from ["'].\/components\/second-choice\.hbs["']/,
        'rule-driven mustache string literal'
      );
    });

    test('curly.hbs', function(assert) {
      let assertFile = assert.file('templates/curly.hbs').transform(build.transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(
        /import \w+ from ["'].\/components\/third-choice\.hbs["']/,
        'static component helper dependency'
      );
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
    });

    test('hello-world.hbs', function(assert) {
      // the point of this test is to ensure that we can transpile with no
      // warning about the dynamicComponentName.
      let assertFile = assert
        .file('node_modules/my-addon/templates/components/hello-world.hbs')
        .transform(build.transpile);

      // this is a pretty trivial test, but it's needed to force the
      // transpilation to happen because transform() is lazy.
      assertFile.matches(/dynamicComponentName/);
    });

    test('addon/hello-world.js', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/hello-world.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/synthetic-import-1/);
      assertFile.matches(/window\.define\(["']\my-addon\/synthetic-import-1["']/);
      assertFile.matches(/import a. from ["']\.\.\/\.\.\/\.\.\/templates\/components\/second-choice\.hbs["']/);
      assertFile.matches(/window\.define\(["']my-app\/templates\/components\/second-choice["']/);
      assertFile.matches(
        /import somethingExternal from ["'].*\/externals\/not-a-resolvable-package["']/,
        'externals are handled correctly'
      );
    });

    test('app/hello-world.js', function(assert) {
      let assertFile = assert.file('./components/hello-world.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/node_modules\/my-addon\/synthetic-import-1/);
      assertFile.matches(/window\.define\(["']my-addon\/synthetic-import-1["']/);
      assertFile.matches(
        /export \{ default \} from ['"]\.\.\/node_modules\/my-addon\/components\/hello-world['"]/,
        'remapped to precise copy of my-addon'
      );
    });

    test('app/templates/components/direct-template-reexport.js', function(assert) {
      let assertFile = assert.file('./templates/components/direct-template-reexport.js').transform(build.transpile);
      assertFile.matches(
        /export \{ default \} from ['"]\.\.\/\.\.\/node_modules\/my-addon\/templates\/components\/hello-world.hbs['"]/,
        'rewrites absolute imports of templates to explicit hbs'
      );
    });

    test('uses-inline-template.js', function(assert) {
      let assertFile = assert.file('./components/uses-inline-template.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/templates\/components\/first-choice.hbs/);
      assertFile.matches(/window\.define\(["']\my-app\/templates\/components\/first-choice["']/);
    });

    test('component with relative import of arbitrarily placed template', function(assert) {
      let assertFile = assert
        .file('node_modules/my-addon/components/has-relative-template.js')
        .transform(build.transpile);
      assertFile.matches(/import layout from ["']\.\/t.hbs['"]/, 'arbitrary relative template gets hbs extension');
    });

    test('app can import a deep addon', function(assert) {
      let assertFile = assert.file('use-deep-addon.js').transform(build.transpile);
      assertFile.matches(/import thing from ["']\.\/node_modules\/my-addon\/node_modules\/deep-addon['"]/);
    });

    test('amd require in an addon gets rewritten to window.require', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/uses-amd-require.js').transform(build.transpile);
      assertFile.matches(/window\.require\(['"]some-package['"]\)/, 'should find window.require');
    });

    test('cjs require in non-ember package does not get rewritten to window.require', function(assert) {
      let assertFile = assert.file('node_modules/babel-filter-test4/index.js').transform(build.transpile);
      assertFile.matches(/return require\(['"]some-package['"]\)/, 'should find plain cjs require');
    });

    test('transpilation runs for ember addons', async function(assert) {
      assert.ok(build.shouldTranspile(assert.file('node_modules/my-addon/components/has-relative-template.js')));
    });

    test('transpilation is skipped when package matches skipBabel', async function(assert) {
      assert.ok(!build.shouldTranspile(assert.file('node_modules/babel-filter-test1/index.js')));
    });

    test('transpilation is skipped when package and version match skipBabel', async function(assert) {
      assert.ok(!build.shouldTranspile(assert.file('node_modules/babel-filter-test2/index.js')));
    });

    test('transpilation runs when package version does not match skipBabel', async function(assert) {
      assert.ok(build.shouldTranspile(assert.file('node_modules/babel-filter-test3/index.js')));
    });

    test('transpilation runs for non-ember package that is not explicitly skipped', async function(assert) {
      assert.ok(build.shouldTranspile(assert.file('node_modules/babel-filter-test4/index.js')));
    });

    test(`app's babel plugins ran`, async function(assert) {
      let assertFile = assert.file('custom-babel-needed.js').transform(build.transpile);
      assertFile.matches(/console\.log\(['"]embroider-sample-transforms-result['"]\)/);
    });
  });
});
