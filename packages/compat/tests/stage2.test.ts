import { Project, BuildResult, ExpectFile, expectFilesAt } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import Options from '../src/options';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import merge from 'lodash/merge';

describe('stage2 build', function() {
  jest.setTimeout(120000);

  describe('static with rules', function() {
    let expectFile: ExpectFile;
    let build: BuildResult;
    let app: Project;

    throwOnWarnings();

    beforeAll(async function() {
      app = Project.emberNew();
      app.linkPackage('ember-auto-import');
      app.linkPackage('@embroider/sample-transforms');

      merge(app.files, {
        app: {
          templates: {
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
          },
          components: {
            'uses-inline-template.js': `
          import hbs from "htmlbars-inline-precompile";
          export default Component.extend({
            layout: hbs${'`'}{{first-choice}}${'`'}
          })
          `,
          },
          'use-deep-addon.js': `import thing from 'deep-addon'`,
          'custom-babel-needed.js': `console.log('embroider-sample-transforms-target');`,
          'does-dynamic-import.js': `
          export default function() {
            return import('some-library');
          }
        `,
        },
        public: {
          'public-file-1.txt': `initial state`,
        },
      });

      let addon = app.addAddon('my-addon');
      merge(addon.files, {
        addon: {
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
        },
        app: {
          components: {
            'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
          },
          templates: {
            components: {
              'direct-template-reexport.js': `export { default } from 'my-addon/templates/components/hello-world';`,
            },
          },
        },
        public: {
          'package.json': JSON.stringify({ customStuff: { fromMyAddon: true }, name: 'should-be-overridden' }),
        },
      });

      let deepAddon = addon.addAddon('deep-addon');
      merge(deepAddon.files, {
        addon: {
          'index.js': '// deep-addon index',
        },
      });

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
          babel: {
            plugins: [require.resolve('ember-auto-import/babel-plugin')],
          },
        },
        embroiderOptions: options,
      });
      expectFile = expectFilesAt(build.outputPath);
    });

    afterAll(async function() {
      await build.cleanup();
    });

    test('index.hbs', function() {
      let assertFile = expectFile('templates/index.hbs').transform(build.transpile);
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

    test('curly.hbs', function() {
      let assertFile = expectFile('templates/curly.hbs').transform(build.transpile);
      assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
      assertFile.matches(
        /import \w+ from ["'].\/components\/third-choice\.hbs["']/,
        'static component helper dependency'
      );
      assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
    });

    test('hello-world.hbs', function() {
      // the point of this test is to ensure that we can transpile with no
      // warning about the dynamicComponentName.
      let assertFile = expectFile('node_modules/my-addon/templates/components/hello-world.hbs').transform(
        build.transpile
      );

      // this is a pretty trivial test, but it's needed to force the
      // transpilation to happen because transform() is lazy.
      assertFile.matches(/dynamicComponentName/);
    });

    test('addon/hello-world.js', function() {
      let assertFile = expectFile('node_modules/my-addon/components/hello-world.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/synthetic-import-1/);
      assertFile.matches(/window\.define\(["']\my-addon\/synthetic-import-1["']/);
      assertFile.matches(/import a. from ["']\.\.\/\.\.\/\.\.\/templates\/components\/second-choice\.hbs["']/);
      assertFile.matches(/window\.define\(["']my-app\/templates\/components\/second-choice["']/);
      assertFile.matches(
        /import somethingExternal from ["'].*\/externals\/not-a-resolvable-package["']/,
        'externals are handled correctly'
      );
    });

    test('app/hello-world.js', function() {
      let assertFile = expectFile('./components/hello-world.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/node_modules\/my-addon\/synthetic-import-1/);
      assertFile.matches(/window\.define\(["']my-addon\/synthetic-import-1["']/);
      assertFile.matches(
        /export \{ default \} from ['"]\.\.\/node_modules\/my-addon\/components\/hello-world['"]/,
        'remapped to precise copy of my-addon'
      );
    });

    test('app/templates/components/direct-template-reexport.js', function() {
      let assertFile = expectFile('./templates/components/direct-template-reexport.js').transform(build.transpile);
      assertFile.matches(
        /export \{ default \} from ['"]\.\.\/\.\.\/node_modules\/my-addon\/templates\/components\/hello-world['"]/,
        'rewrites reexports of templates'
      );
    });

    test('uses-inline-template.js', function() {
      let assertFile = expectFile('./components/uses-inline-template.js').transform(build.transpile);
      assertFile.matches(/import a. from ["']\.\.\/templates\/components\/first-choice.hbs/);
      assertFile.matches(/window\.define\(["']\my-app\/templates\/components\/first-choice["']/);
    });

    test('component with relative import of arbitrarily placed template', function() {
      let assertFile = expectFile('node_modules/my-addon/components/has-relative-template.js').transform(
        build.transpile
      );
      assertFile.matches(/import layout from ["']\.\/t['"]/, 'arbitrary relative template remains the same');
    });

    test('app can import a deep addon', function() {
      let assertFile = expectFile('use-deep-addon.js').transform(build.transpile);
      assertFile.matches(/import thing from ["']\.\/node_modules\/my-addon\/node_modules\/deep-addon['"]/);
    });

    test('amd require in an addon gets rewritten to window.require', function() {
      let assertFile = expectFile('node_modules/my-addon/components/uses-amd-require.js').transform(build.transpile);
      assertFile.matches(/window\.require\(['"]some-package['"]\)/, 'should find window.require');
    });

    test('cjs require in non-ember package does not get rewritten to window.require', function() {
      let assertFile = expectFile('node_modules/babel-filter-test4/index.js').transform(build.transpile);
      assertFile.matches(/return require\(['"]some-package['"]\)/, 'should find plain cjs require');
    });

    test('transpilation runs for ember addons', async function() {
      expect(
        build.shouldTranspile(expectFile('node_modules/my-addon/components/has-relative-template.js'))
      ).toBeTruthy();
    });

    test('transpilation is skipped when package matches skipBabel', async function() {
      expect(!build.shouldTranspile(expectFile('node_modules/babel-filter-test1/index.js'))).toBeTruthy();
    });

    test('transpilation is skipped when package and version match skipBabel', async function() {
      expect(!build.shouldTranspile(expectFile('node_modules/babel-filter-test2/index.js'))).toBeTruthy();
    });

    test('transpilation runs when package version does not match skipBabel', async function() {
      expect(build.shouldTranspile(expectFile('node_modules/babel-filter-test3/index.js'))).toBeTruthy();
    });

    test('transpilation runs for non-ember package that is not explicitly skipped', async function() {
      expect(build.shouldTranspile(expectFile('node_modules/babel-filter-test4/index.js'))).toBeTruthy();
    });

    test(`app's babel plugins ran`, async function() {
      let assertFile = expectFile('custom-babel-needed.js').transform(build.transpile);
      assertFile.matches(/console\.log\(['"]embroider-sample-transforms-result['"]\)/);
    });

    test(`changes in app.css are propagated at rebuild`, async function() {
      expectFile('assets/my-app.css').doesNotMatch('newly-added-class');
      writeFileSync(join(app.baseDir, 'app/styles/app.css'), `.newly-added-class { color: red }`);
      await build.rebuild();
      expectFile('assets/my-app.css').matches('newly-added-class');
    });

    test(`public assets are included`, async function() {
      expectFile('public-file-1.txt').matches(/initial state/);
      expectFile('package.json')
        .json()
        .get('ember-addon.assets')
        .includes('public-file-1.txt');
    });

    test(`updated public asset`, async function() {
      writeFileSync(join(app.baseDir, 'public/public-file-1.txt'), `updated state`);
      await build.rebuild();
      expectFile('public-file-1.txt').matches(/updated state/);
    });

    test(`added public asset`, async function() {
      writeFileSync(join(app.baseDir, 'public/public-file-2.txt'), `added`);
      await build.rebuild();
      expectFile('public-file-2.txt').matches(/added/);
      expectFile('package.json')
        .json()
        .get('ember-addon.assets')
        .includes('public-file-2.txt');
    });

    test(`removed public asset`, async function() {
      unlinkSync(join(app.baseDir, 'public/public-file-1.txt'));
      await build.rebuild();
      expectFile('public-file-1.txt').doesNotExist();
      expectFile('package.json')
        .json()
        .get('ember-addon.assets')
        .doesNotInclude('public-file-1.txt');
    });

    test('dynamic import is preserved', function() {
      expectFile('./does-dynamic-import.js')
        .transform(build.transpile)
        .matches(/return import\(['"]some-library['"]\)/);
    });

    test('addons can merge additional content into package.json', function() {
      let file = expectFile('./package.json').json();
      file.get('ember-addon.version').equals(2, 'our own content is present');
      file.get('customStuff').deepEquals({ fromMyAddon: true }, 'the addons content is present');
      file.get('name').equals('my-app', 'app takes precedence over addon');
    });
  });
});
