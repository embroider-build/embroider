import fs from 'fs-extra';
import { join } from 'path';
import resolve from 'resolve';
import merge from 'lodash/merge';
import { appReleaseScenario, baseAddon, dummyAppScenarios } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import { TransformOptions, transform } from '@babel/core';
import QUnit from 'qunit';
import { fixturifyInRepoAddon, createEmberEngine } from './helpers';
const { module: Qmodule, test } = QUnit;

function babelTransform(workspaceDir: string, filePath: string, babelConfig: TransformOptions) {
  let fileContents = fs.readFileSync(join(workspaceDir, filePath));
  return transform(fileContents.toString(), Object.assign({ filename: join(workspaceDir, filePath) }, babelConfig))!
    .code!;
}
appReleaseScenario
  .map('stage-2-build', project => {
    let depA = baseAddon();
    let depB = baseAddon();
    let depC = baseAddon();

    depA.pkg.name = 'dep-a';
    depB.pkg.name = 'dep-b';
    depC.pkg.name = 'dep-c';

    project.addDependency(depA);
    project.addDependency(depB);
    project.addDependency(depC);

    depA.pkg['ember-addon'] = { paths: ['lib/in-repo-a'] };
    depB.pkg['ember-addon'] = { paths: ['lib/in-repo-b', 'lib/in-repo-c'] };
    depC.pkg['ember-addon'] = { paths: ['lib/in-repo-d'] };

    merge(depA.files, merge(fixturifyInRepoAddon('in-repo-a'), { app: { services: { 'in-repo.js': 'in-repo-a' } } }));
    merge(depB.files, merge(fixturifyInRepoAddon('in-repo-b'), { app: { services: { 'in-repo.js': 'in-repo-b' } } }));
    merge(depB.files, merge(fixturifyInRepoAddon('in-repo-c'), { app: { services: { 'in-repo.js': 'in-repo-c' } } }));
    merge(depC.files, merge(fixturifyInRepoAddon('in-repo-d'), { app: { services: { 'in-repo.js': 'in-repo-d' } } }));

    project.pkg['ember-addon'] = {
      paths: ['lib/primary-in-repo-addon'],
    };

    // make an in-repo addon with a dependency on a secondary in-repo-addon
    merge(project.files, {
      lib: {
        'primary-in-repo-addon': {
          'index.js': `module.exports = {
            name: require('./package').name,
          };`,
          'package.json': `{ "name": "primary-in-repo-addon", "keywords": ["ember-addon"], "ember-addon": { "paths": ["../secondary-in-repo-addon"] } }`,
        },
        'secondary-in-repo-addon': {
          'index.js': `module.exports = {
            name: require('./package').name,
          };`,
          'package.json': '{ "name": "secondary-in-repo-addon", "keywords": ["ember-addon"] }',
          app: {
            services: {
              'secondary.js': '// secondary',
            },
          },
          addon: {
            components: {
              'secondary.js': '// secondary component',
            },
          },
        },
      },
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} build`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');
      });

      test('in repo addons are symlinked correctly', function (assert) {
        let depAPackage = fs.readJsonSync(join(workspaceDir, 'node_modules/dep-a/package.json'));
        let depBPackage = fs.readJsonSync(join(workspaceDir, 'node_modules/dep-b/package.json'));

        assert.equal(depAPackage.dependencies['in-repo-a'], '*');
        assert.equal(depBPackage.dependencies['in-repo-b'], '*');
        assert.equal(depBPackage.dependencies['in-repo-c'], '*');

        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/dep-a/node_modules/in-repo-a/package.json')));
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/dep-b/node_modules/in-repo-b/package.json')));
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/dep-b/node_modules/in-repo-c/package.json')));

        let inRepoAPackage = fs.readJsonSync(
          join(workspaceDir, 'node_modules/dep-a/node_modules/in-repo-a/package.json')
        );
        let inRepoBPackage = fs.readJsonSync(
          join(workspaceDir, 'node_modules/dep-b/node_modules/in-repo-b/package.json')
        );
        let inRepoCPackage = fs.readJsonSync(
          join(workspaceDir, 'node_modules/dep-b/node_modules/in-repo-c/package.json')
        );
        assert.equal(inRepoAPackage['ember-addon'].version, 2);
        assert.equal(inRepoBPackage['ember-addon'].version, 2);
        assert.equal(inRepoCPackage['ember-addon'].version, 2);

        // check that the app trees with in repo addon are combined correctly
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/in-repo.js'));
        assert.ok(fileContents.includes('in-repo-d')); // TODO: this was in-repo-c?
      });

      test('incorporates in-repo-addons of in-repo-addons correctly', function (assert) {
        // secondary in-repo-addon was correctly detected and activated
        assert.ok(fs.existsSync(join(workspaceDir, 'services/secondary.js')));

        // secondary is resolvable from primary
        assert.ok(
          resolve.sync('secondary-in-repo-addon/components/secondary', {
            basedir: join(workspaceDir, 'node_modules', 'primary-in-repo-addon'),
          })
        );
      });
    });
  });

appReleaseScenario
  .map('stage-2', project => {
    let depA = baseAddon();
    let depB = baseAddon();

    depA.pkg.name = 'dep-a';
    depB.pkg.name = 'dep-b';

    merge(depB.files, {
      app: { services: { 'addon.js': 'dep-b', 'dep-wins-over-dev.js': 'dep-b', 'in-repo-over-deps.js': 'dep-b' } },
    });
    merge(depA.files, { app: { services: { 'addon.js': 'dep-a' } } });

    merge(
      project.files,
      merge(fixturifyInRepoAddon('in-repo-a'), {
        app: { services: { 'in-repo.js': 'in-repo-a', 'in-repo-over-deps.js': 'in-repo-a' } },
      })
    );

    merge(
      project.files,
      merge(fixturifyInRepoAddon('in-repo-b'), { app: { services: { 'in-repo.js': 'in-repo-b' } } })
    );

    project.addDependency(depA);
    project.addDependency(depB);

    let devA = baseAddon();
    let devB = baseAddon();
    let devC = baseAddon();
    let devD = baseAddon();
    let devE = baseAddon();
    let devF = baseAddon();

    devA.pkg.name = 'dev-a';
    devB.pkg.name = 'dev-b';
    devC.pkg.name = 'dev-c';
    devD.pkg.name = 'dev-d';
    devE.pkg.name = 'dev-e';
    devF.pkg.name = 'dev-f';

    project.addDevDependency(devA);
    project.addDevDependency(devB);
    project.addDevDependency(devC);
    project.addDevDependency(devD);
    project.addDevDependency(devE);
    project.addDevDependency(devF);

    (devB.pkg['ember-addon'] as any).after = 'dev-e';
    (devF.pkg['ember-addon'] as any).before = 'dev-d';

    merge(devA.files, { app: { services: { 'dev-addon.js': 'dev-a', 'dep-wins-over-dev.js': 'dev-a' } } });
    merge(devB.files, { app: { services: { 'test-after.js': 'dev-b' } } });
    merge(devC.files, { app: { services: { 'dev-addon.js': 'dev-c' } } });
    merge(devD.files, { app: { services: { 'test-before.js': 'dev-d' } } });
    merge(devE.files, { app: { services: { 'test-after.js': 'dev-e' } } });
    merge(devF.files, { app: { services: { 'test-before.js': 'dev-f' } } });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} addon ordering is preserved from ember-cli with orderIdx`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');
      });

      test('verifies that the correct lexigraphically sorted addons win', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/in-repo.js'));
        assert.ok(fileContents.includes('in-repo-b'));

        let fileContentsAddon = fs.readFileSync(join(workspaceDir, 'services/addon.js'));
        assert.ok(fileContentsAddon.includes('dep-b'));

        let fileContentsDevAddon = fs.readFileSync(join(workspaceDir, 'services/dev-addon.js'));
        assert.ok(fileContentsDevAddon.includes('dev-c'));
      });

      test('addons declared as dependencies should win over devDependencies', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/dep-wins-over-dev.js'));
        assert.ok(fileContents.includes('dep-b'));
      });

      test('in repo addons declared win over dependencies', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/in-repo-over-deps.js'));
        assert.ok(fileContents.includes('in-repo-a'));
      });

      test('ordering with before specified', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/test-before.js'));
        assert.ok(fileContents.includes('dev-d'));
      });

      test('ordering with after specified', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'services/test-after.js'));
        assert.ok(fileContents.includes('dev-b'));
      });
    });
  });

appReleaseScenario
  .map('stage-2-static-with-rules', project => {
    let someLibrary = new Project('some-library', '1.0.0');

    project.addDependency(someLibrary);
    project.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });

    merge(project.files, {
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
            'module-name-check': {
              'index.hbs': '<div class={{embroider-sample-transforms-module}}>hello world</div>',
            },
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
        helpers: {
          'embroider-sample-transforms-module.js': 'export default function() {}',
        },
        'static-dir': {
          'my-library.js': '',
        },
        'static-dir-not-really': {
          'something.js': '',
        },
        'non-static-dir': {
          'another-library.js': '',
        },
        'top-level-static.js': '',
      },
      public: {
        'public-file-1.txt': `initial state`,
      },
    });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
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

    let deepAddon = baseAddon();
    deepAddon.pkg.name = 'deep-addon';
    merge(deepAddon.files, {
      addon: {
        'index.js': '// deep-addon index',
      },
    });
    addon.addDependency(deepAddon);
    project.addDependency(addon);

    let babelFilterTest1 = new Project('babel-filter-test1', '1.2.3');
    let babelFilterTest2 = new Project('babel-filter-test2', '4.5.6');
    let babelFilterTest3 = new Project('babel-filter-test3', '1.0.0');
    let babelFilterTest4 = new Project('babel-filter-test4', '1.0.0');

    merge(babelFilterTest1.files, { 'index.js': '' });
    merge(babelFilterTest2.files, { 'index.js': '' });
    merge(babelFilterTest3.files, { 'index.js': '' });

    merge(babelFilterTest4.files, {
      'index.js': `
        module.exports = function() {
          return require('some-package');
        }
      `,
    });

    project.addDependency(babelFilterTest1);
    project.addDependency(babelFilterTest2);
    project.addDependency(babelFilterTest3);
    project.addDependency(babelFilterTest4);

    merge(project.files, {
      'ember-cli-build.js': `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {
          babel: {
            plugins: [require.resolve('ember-auto-import/babel-plugin')],
          }
        });

        const { Webpack } = require('@embroider/webpack');
        return require('@embroider/compat').compatBuild(app, Webpack, {
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
          staticAppPaths: ['static-dir', 'top-level-static.js'],
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
        });
      };
      `,
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} static with rules`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;
      let compiler: any;
      let babelConfig: TransformOptions;
      let shouldTranspile: any;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');

        let projectMeta = fs.readJSONSync(join(workspaceDir, 'package.json'))['ember-addon'];
        compiler = require(join(workspaceDir, projectMeta['template-compiler'].filename));
        babelConfig = require(join(workspaceDir, projectMeta['babel'].filename)) as TransformOptions;
        shouldTranspile = require(join(workspaceDir, '_babel_filter_'));
      });

      test('index.hbs', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'templates/index.hbs'));
        let assertFile = compiler.compile(join(workspaceDir, 'templates/index.hbs'), fileContents.toString());

        assert.ok(
          /import \w+ from ["']..\/components\/hello-world\.js["']/.test(assertFile.toString()),
          'explicit dependency'
        );
        assert.ok(
          /import \w+ from ["'].\/components\/third-choice\.hbs["']/.test(assertFile.toString()),
          'static component helper dependency'
        );
        assert.ok(
          /import \w+ from ["'].\/components\/first-choice\.hbs["']/.test(assertFile.toString()),
          'rule-driven string attribute'
        );
        assert.ok(
          /import \w+ from ["'].\/components\/second-choice\.hbs["']/.test(assertFile.toString()),
          'rule-driven mustache string literal'
        );
      });

      test('curly.hbs', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'templates/curly.hbs'));
        let assertFile = compiler.compile(join(workspaceDir, 'templates/curly.hbs'), fileContents.toString());

        assert.ok(
          /import \w+ from ["']..\/components\/hello-world\.js["']/.test(assertFile.toString()),
          'explicit dependency'
        );

        assert.ok(
          /import \w+ from ["'].\/components\/third-choice\.hbs["']/.test(assertFile.toString()),
          'static component helper dependency'
        );

        assert.ok(
          /import \w+ from ["'].\/components\/first-choice\.hbs["']/.test(assertFile.toString()),
          'rule-driven string attribute'
        );
      });

      test('hello-world.hbs', function (assert) {
        // the point of this test is to ensure that we can transpile with no
        // warning about the dynamicComponentName.
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/templates/components/hello-world.hbs')
        );
        let assertFile = compiler.compile(
          join(workspaceDir, 'node_modules/my-addon/templates/components/hello-world.hbs'),
          fileContents.toString()
        );

        assert.ok(/dynamicComponentName/.test(assertFile.toString()));
      });

      test('addon/hello-world.js', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'node_modules/my-addon/components/hello-world.js'));
        let assertFile = transform(
          fileContents.toString(),
          Object.assign(
            { filename: join(workspaceDir, 'node_modules/my-addon/components/hello-world.js') },
            babelConfig
          )
        )!.code!;

        assert.ok(/import \* as a. from ["']\.\.\/synthetic-import-1/.test(assertFile.toString()));
        assert.ok(/window\.define\(["']\my-addon\/synthetic-import-1["']/.test(assertFile.toString()));
        assert.ok(
          /import \* as a. from ["']\.\.\/\.\.\/\.\.\/templates\/components\/second-choice\.hbs["']/.test(
            assertFile.toString()
          )
        );
        assert.ok(
          /window\.define\(["']app-template\/templates\/components\/second-choice["']/.test(assertFile.toString())
        );
        assert.ok(
          /import somethingExternal from ["'].*\/externals\/not-a-resolvable-package["']/.test(assertFile.toString()),
          'externals are handled correctly'
        );
      });

      test('app/hello-world.js', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'components/hello-world.js'));
        let assertFile = transform(
          fileContents.toString(),
          Object.assign({ filename: join(workspaceDir, 'components/hello-world.js') }, babelConfig)
        )!.code!;

        assert.ok(
          /import \* as a. from ["']\.\.\/node_modules\/my-addon\/synthetic-import-1/.test(assertFile.toString())
        );
        assert.ok(/window\.define\(["']my-addon\/synthetic-import-1["']/.test(assertFile.toString()));
        assert.ok(
          /export \{ default \} from ['"]\.\.\/node_modules\/my-addon\/components\/hello-world['"]/.test(
            assertFile.toString()
          ),
          'remapped to precise copy of my-addon'
        );
      });

      test('app/templates/components/direct-template-reexport.js', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'templates/components/direct-template-reexport.js'));
        let assertFile = transform(
          fileContents.toString(),
          Object.assign(
            { filename: join(workspaceDir, 'templates/components/direct-template-reexport.js') },
            babelConfig
          )
        )!.code!;

        assert.ok(
          /export \{ default \} from ['"]\.\.\/\.\.\/node_modules\/my-addon\/templates\/components\/hello-world['"]/.test(
            assertFile.toString()
          ),
          'rewrites reexports of templates'
        );
      });

      test('uses-inline-template.js', function (assert) {
        let assertFile = babelTransform(workspaceDir, 'components/uses-inline-template.js', babelConfig);
        assert.ok(/import a. from ["']\.\.\/templates\/components\/first-choice.hbs/.test(assertFile.toString()));
        assert.ok(
          /window\.define\(["']\app-template\/templates\/components\/first-choice["']/.test(assertFile.toString())
        );
      });

      test('component with relative import of arbitrarily placed template', function (assert) {
        let assertFile = babelTransform(
          workspaceDir,
          'node_modules/my-addon/components/has-relative-template.js',
          babelConfig
        );
        assert.ok(
          /import layout from ["']\.\/t['"]/.test(assertFile.toString()),
          'arbitrary relative template remains the same'
        );
      });

      test('app can import a deep addon', function (assert) {
        let assertFile = babelTransform(workspaceDir, 'use-deep-addon.js', babelConfig);
        assert.ok(
          /import thing from ["']\.\/node_modules\/my-addon\/node_modules\/deep-addon['"]/.test(assertFile.toString())
        );
      });

      test('amd require in an addon gets rewritten to window.require', function (assert) {
        let assertFile = babelTransform(
          workspaceDir,
          'node_modules/my-addon/components/uses-amd-require.js',
          babelConfig
        );
        assert.ok(/window\.require\(['"]some-package['"]\)/.test(assertFile.toString()), 'should find window.require');
      });

      test('cjs require in non-ember package does not get rewritten to window.require', function (assert) {
        let assertFile = babelTransform(workspaceDir, 'node_modules/babel-filter-test4/index.js', babelConfig);
        assert.ok(
          /return require\(['"]some-package['"]\)/.test(assertFile.toString()),
          'should find plain cjs require'
        );
      });

      test('transpilation runs for ember addons', function (assert) {
        assert.ok(shouldTranspile(join(workspaceDir, 'node_modules/my-addon/components/has-relative-template.js')));
      });

      test('transpilation is skipped when package matches skipBabel', function (assert) {
        assert.notOk(shouldTranspile(join(workspaceDir, 'node_modules/babel-filter-test1/index.js')));
      });

      test('transpilation is skipped when package and version match skipBabel', function (assert) {
        assert.notOk(shouldTranspile(join(workspaceDir, 'node_modules/babel-filter-test2/index.js')));
      });

      test('transpilation runs when package version does not match skipBabel', function (assert) {
        assert.ok(shouldTranspile(join(workspaceDir, 'node_modules/babel-filter-test3/index.js')));
      });

      test('transpilation runs for non-ember package that is not explicitly skipped', function (assert) {
        assert.ok(shouldTranspile(join(workspaceDir, 'node_modules/babel-filter-test4/index.js')));
      });

      test(`app's babel plugins ran`, function (assert) {
        let assertFile = babelTransform(workspaceDir, 'custom-babel-needed.js', babelConfig);
        assert.ok(/console\.log\(['"]embroider-sample-transforms-result['"]\)/.test(assertFile.toString()));
      });

      test('changes in app.css are propagated at rebuild', async function (assert) {
        let fileContentsBefore = fs.readFileSync(join(workspaceDir, 'assets/app-template.css'));
        assert.notOk(fileContentsBefore.includes('newly-added-class'));

        fs.writeFileSync(join(app.dir, 'app/styles/app.css'), `.newly-added-class { color: red }`);

        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');

        let fileContentsAfter = fs.readFileSync(join(workspaceDir, 'assets/app-template.css'));
        assert.ok(fileContentsAfter.includes('newly-added-class'));
      });

      test('public assets are included', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'public-file-1.txt'));
        assert.ok(fileContents.includes('initial state'));

        let fileContentsJson = fs.readJSONSync(join(workspaceDir, 'package.json'));
        assert.ok(fileContentsJson['ember-addon'].assets.includes('public-file-1.txt'));
      });

      test('updated public asset', async function (assert) {
        fs.writeFileSync(join(app.dir, 'public/public-file-1.txt'), `updated state`);

        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');

        let fileContents = fs.readFileSync(join(workspaceDir, 'public-file-1.txt'));
        assert.ok(fileContents.includes('updated state'));
      });

      test(`added public asset`, async function (assert) {
        fs.writeFileSync(join(app.dir, 'public/public-file-2.txt'), `added`);

        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');

        let fileContents = fs.readFileSync(join(workspaceDir, 'public-file-2.txt'));
        assert.ok(fileContents.includes('added'));

        let fileContentsJson = fs.readJsonSync(join(workspaceDir, 'package.json'));
        assert.ok(fileContentsJson['ember-addon'].assets.includes('public-file-2.txt'));
      });

      test(`removed public asset`, async function (assert) {
        fs.unlinkSync(join(app.dir, 'public/public-file-1.txt'));

        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');

        assert.notOk(fs.existsSync(join(workspaceDir, 'public-file-1.txt')));
        let fileContentsJson = fs.readJsonSync(join(workspaceDir, 'package.json'));
        assert.notOk(fileContentsJson['ember-addon'].assets.includes('public-file-1.txt'));
      });

      test('dynamic import is preserved', function (assert) {
        let assertFile = babelTransform(workspaceDir, 'does-dynamic-import.js', babelConfig);
        assert.ok(/return import\(['"]some-library['"]\)/.test(assertFile.toString()));
      });

      test('hbs transform sees expected module name', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'templates/components/module-name-check/index.hbs'));
        let assertFile = compiler.compile(
          join(workspaceDir, 'templates/components/module-name-check/index.hbs'),
          fileContents.toString()
        );

        assert.ok(
          /"app-template\/templates\/components\/module-name-check\/index.hbs"/.test(assertFile.toString()),
          'our sample transform injected the expected moduleName into the compiled template'
        );
      });

      test('non-static other paths are included in the entrypoint', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/app-template.js'));
        assert.ok(/i\("..\/non-static-dir\/another-library\.js"\)/.test(fileContents.toString()));
      });

      test('static other paths are not included in the entrypoint', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/app-template.js'));
        assert.notOk(/i\("..\/static-dir\/my-library\.js"\)/.test(fileContents.toString()));
      });

      test('top-level static other paths are not included in the entrypoint', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/app-template.js'));
        assert.notOk(/i\("..\/top-level-static\.js"\)/.test(fileContents.toString()));
      });

      test('staticAppPaths do not match partial path segments', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/app-template.js'));
        assert.ok(/i\("..\/static-dir-not-really\/something\.js"\)/.test(fileContents.toString()));
      });
    });
  });

dummyAppScenarios
  .map('stage-2-addon-dummy-app', project => {
    project.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDependency('@embroider/core', { baseDir: __dirname });
    project.linkDependency('@embroider/compat', { baseDir: __dirname });
    project.linkDependency('@embroider/webpack', { baseDir: __dirname });
    merge(project.files, {
      addon: {
        components: {
          'hello-world.js': `
            import { isDevelopingThisPackage } from '@embroider/macros';
            console.log(isDevelopingThisPackage());`,
        },
      },
      tests: {
        dummy: {
          app: {
            components: {
              'inside-dummy-app.js': `
                import { isDevelopingThisPackage } from '@embroider/macros';
                console.log(isDevelopingThisPackage());`,
            },
          },
        },
      },
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} addon dummy app`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;
      let babelConfig: TransformOptions;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');

        let projectMeta = fs.readJSONSync(join(workspaceDir, 'package.json'))['ember-addon'];
        babelConfig = require(join(workspaceDir, projectMeta['babel'].filename)) as TransformOptions;
      });

      test('dummy app sees that its being developed', function (assert) {
        let assertFile = babelTransform(workspaceDir, 'components/inside-dummy-app.js', babelConfig);
        assert.ok(/console\.log\(true\)/.test(assertFile.toString()));
      });

      test('addon within dummy app sees that its being developed', function (assert) {
        let assertFile = babelTransform(
          workspaceDir,
          'node_modules/addon-template/components/hello-world.js',
          babelConfig
        );
        console.log(assertFile.toString());
        assert.ok(/console\.log\(true\)/.test(assertFile.toString()));
      });
    });
  });

appReleaseScenario
  .map('stage-2-engines-with-css', project => {
    project.addDependency(createEmberEngine());
    let lazyEngine = baseAddon();
    let eagerEngine = baseAddon();
    eagerEngine.pkg.name = 'eager-engine';
    eagerEngine.pkg.peerDependencies = { 'ember-engines': '*' };
    eagerEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];
    lazyEngine.pkg.name = 'lazy-engine';
    lazyEngine.pkg.peerDependencies = { 'ember-engines': '*' };
    lazyEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];

    eagerEngine.addDependency(createEmberEngine());
    lazyEngine.addDependency(createEmberEngine());

    merge(lazyEngine.files, {
      'index.js': `const { buildEngine } = require('ember-engines/lib/engine-addon');
      module.exports = buildEngine({
        name: require('./package').name,
        lazyLoading: {
          enabled: true,
        },
      });`,
      config: {
        'environment.js': `module.exports = function(environment) {
          const ENV = {
            modulePrefix: 'lazy-engine',
            environment: environment
          }
          return ENV;
        };`,
      },
      addon: {
        'engine.js': `import Engine from '@ember/engine';
        import loadInitializers from 'ember-load-initializers';
        import Resolver from 'ember-resolver';
        import config from './config/environment';
        const { modulePrefix } = config;
        export default class YourEngine extends Engine {
          modulePrefix = modulePrefix;
          Resolver = Resolver;
        }
        loadInitializers(YourEngine, modulePrefix);`,
        styles: {
          'addon.css': `.lazy { background-color: red; }`,
        },
      },
    });
    merge(eagerEngine.files, {
      'index.js': `const { buildEngine } = require('ember-engines/lib/engine-addon');
      module.exports = buildEngine({
        name: require('./package').name,
        lazyLoading: {
          enabled: false,
        },
      });`,
      config: {
        'environment.js': `module.exports = function(environment) {
          const ENV = {
            modulePrefix: 'eager-engine',
            environment: environment
          }
          return ENV;
        };`,
      },
      addon: {
        'engine.js': `import Engine from '@ember/engine';
        import loadInitializers from 'ember-load-initializers';
        import Resolver from 'ember-resolver';
        import config from './config/environment';
        const { modulePrefix } = config;
        export default class YourEngine extends Engine {
          modulePrefix = modulePrefix;
          Resolver = Resolver;
        }
        loadInitializers(YourEngine, modulePrefix);`,
        styles: {
          'addon.css': `.eager { background-color: blue; }`,
        },
      },
    });
    project.addDependency(lazyEngine);
    project.addDependency(eagerEngine);
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} engines with css`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');
      });

      test('lazy engines appear in _embroiderEngineBundles_', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/app-template.js'));
        assert.ok(
          fileContents.includes(`w._embroiderEngineBundles_ = [
  {
    names: ["lazy-engine"],
    load: function() {
      return import("./_engine_/lazy-engine.js");
    }
  },
]`)
        );
      });

      test('lazy engine css is imported', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/_engine_/lazy-engine.js'));
        assert.ok(
          fileContents.includes(`  if (macroCondition(!getGlobalConfig().fastboot?.isRunning)) {
i(\"../../node_modules/lazy-engine/lazy-engine.css\");
  }`)
        );
      });

      test('eager engine css is merged with vendor.css', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/vendor.css'));
        assert.ok(fileContents.includes(`.eager { background-color: blue; }`));
      });
    });
  });

appReleaseScenario
  .map('stage-2-lazy-engines-without-css', project => {
    project.addDependency(createEmberEngine());
    let lazyEngine = baseAddon();
    lazyEngine.pkg.name = 'lazy-engine';
    lazyEngine.pkg.peerDependencies = { 'ember-engines': '*' };
    lazyEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];

    lazyEngine.addDependency(createEmberEngine());

    merge(lazyEngine.files, {
      'index.js': `const { buildEngine } = require('ember-engines/lib/engine-addon');
      module.exports = buildEngine({
        name: require('./package').name,
        lazyLoading: {
          enabled: true,
        },
      });`,
      config: {
        'environment.js': `module.exports = function(environment) {
          const ENV = {
            modulePrefix: 'lazy-engine',
            environment: environment
          }
          return ENV;
        };`,
      },
      addon: {
        'engine.js': `import Engine from '@ember/engine';
        import loadInitializers from 'ember-load-initializers';
        import Resolver from 'ember-resolver';
        import config from './config/environment';
        const { modulePrefix } = config;
        export default class YourEngine extends Engine {
          modulePrefix = modulePrefix;
          Resolver = Resolver;
        }
        loadInitializers(YourEngine, modulePrefix);`,
      },
    });

    project.addDependency(lazyEngine);
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} lazy engines without css`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE2_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage2-output'), 'utf8');
      });

      test('lazy engine css is not imported', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'assets/_engine_/lazy-engine.js'));
        assert.notOk(
          fileContents.includes(`  if (macroCondition(!getGlobalConfig().fastboot?.isRunning)) {
i(\"../../node_modules/lazy-engine/lazy-engine.css\");
  }`)
        );
      });
    });
  });
