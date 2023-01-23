import { Options } from '@embroider/compat';
import { writeFileSync, unlinkSync } from 'fs';
import resolve from 'resolve';
import { PreparedApp, Project } from 'scenario-tester';
import { appScenarios, baseAddon, dummyAppScenarios, renameApp } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExpectFile, expectFilesAt, Rebuilder, Transpiler } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import QUnit from 'qunit';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

let stage2Scenarios = appScenarios.map('compat-stage2-build', app => {
  renameApp(app, 'my-app');
});

stage2Scenarios
  .map('in-repo-addons-of-addons', app => {
    let depA = addAddon(app, 'dep-a');
    let depB = addAddon(app, 'dep-b');
    let depC = addAddon(app, 'dep-c');

    depA.linkDependency('dep-c', { project: depC });
    depB.linkDependency('dep-c', { project: depC });

    addInRepoAddon(depC, 'in-repo-d', {
      app: { service: { 'in-repo.js': 'in-repo-d' } },
    });
    addInRepoAddon(depA, 'in-repo-a', {
      app: { service: { 'in-repo.js': 'in-repo-a' } },
    });
    addInRepoAddon(depB, 'in-repo-b', {
      app: { service: { 'in-repo.js': 'in-repo-b' } },
    });
    addInRepoAddon(depB, 'in-repo-c', {
      app: { service: { 'in-repo.js': 'in-repo-c' } },
    });

    // make an in-repo addon with a dependency on a secondary in-repo-addon
    addInRepoAddon(app, 'primary-in-repo-addon', {
      'package.json': JSON.stringify(
        {
          name: 'primary-in-repo-addon',
          keywords: ['ember-addon'],
          'ember-addon': {
            paths: ['../secondary-in-repo-addon'],
          },
        },
        null,
        2
      ),
    });

    // critically, this in-repo addon gets removed from the app's actual
    // ember-addon.paths, so it's *only* consumed by primary-in-repo-addon.
    addInRepoAddon(app, 'secondary-in-repo-addon', {
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
    });
    (app.pkg['ember-addon'] as any).paths = (app.pkg['ember-addon'] as any).paths.filter(
      (p: string) => p !== 'lib/secondary-in-repo-addon'
    );
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('in repo addons are symlinked correctly', function () {
        // check that package json contains in repo dep
        expectFile('./node_modules/dep-a/package.json').json().get('dependencies.in-repo-a').equals('0.0.0');
        expectFile('./node_modules/dep-b/package.json').json().get('dependencies.in-repo-b').equals('0.0.0');
        expectFile('./node_modules/dep-b/package.json').json().get('dependencies.in-repo-c').equals('0.0.0');

        // check that symlinks are correct
        expectFile('./node_modules/dep-a/node_modules/in-repo-a/package.json').exists();
        expectFile('./node_modules/dep-b/node_modules/in-repo-b/package.json').exists();
        expectFile('./node_modules/dep-b/node_modules/in-repo-c/package.json').exists();

        // check that the in repo addons are correct upgraded
        expectFile('./node_modules/dep-a/node_modules/in-repo-a/package.json')
          .json()
          .get('ember-addon.version')
          .equals(2);
        expectFile('./node_modules/dep-b/node_modules/in-repo-b/package.json')
          .json()
          .get('ember-addon.version')
          .equals(2);
        expectFile('./node_modules/dep-b/node_modules/in-repo-c/package.json')
          .json()
          .get('ember-addon.version')
          .equals(2);

        // check that the app trees with in repo addon are combined correctly
        expectFile('./service/in-repo.js').matches(/in-repo-c/);
      });

      test('incorporates in-repo-addons of in-repo-addons correctly', function (assert) {
        // secondary in-repo-addon was correctly detected and activated
        expectFile('./services/secondary.js').exists();

        assert.ok(
          resolve.sync('secondary-in-repo-addon/components/secondary', {
            basedir: join(expectFile.basePath, 'node_modules', 'primary-in-repo-addon'),
          }),
          'secondary is resolvable from primary'
        );
      });
    });
  });

stage2Scenarios
  .map('addon-ordering-is-preserved', app => {
    // these test attempt to describe the addon ordering behavior from ember-cli that was
    // introduced via: https://github.com/ember-cli/ember-cli/commit/098a9b304b551fe235bd42399ce6975af2a1bc48

    let depB = addAddon(app, 'dep-b');
    let depA = addAddon(app, 'dep-a');

    merge(depB.files, {
      app: { service: { 'addon.js': 'dep-b', 'dep-wins-over-dev.js': 'dep-b', 'in-repo-over-deps.js': 'dep-b' } },
    });
    merge(depA.files, { app: { service: { 'addon.js': 'dep-a' } } });

    addInRepoAddon(app, 'in-repo-a', {
      app: { service: { 'in-repo.js': 'in-repo-a', 'in-repo-over-deps.js': 'in-repo-a' } },
    });
    addInRepoAddon(app, 'in-repo-b', { app: { service: { 'in-repo.js': 'in-repo-b' } } });

    let devA = addDevAddon(app, 'dev-a');
    let devB = addDevAddon(app, 'dev-b');
    let devC = addDevAddon(app, 'dev-c');
    let devD = addDevAddon(app, 'dev-d');
    let devE = addDevAddon(app, 'dev-e');
    let devF = addDevAddon(app, 'dev-f');

    (devB.pkg['ember-addon'] as any).after = 'dev-e';
    (devF.pkg['ember-addon'] as any).before = 'dev-d';

    merge(devA.files, { app: { service: { 'dev-addon.js': 'dev-a', 'dep-wins-over-dev.js': 'dev-a' } } });
    merge(devB.files, { app: { service: { 'test-after.js': 'dev-b' } } });
    merge(devC.files, { app: { service: { 'dev-addon.js': 'dev-c' } } });
    merge(devD.files, { app: { service: { 'test-before.js': 'dev-d' } } });
    merge(devE.files, { app: { service: { 'test-after.js': 'dev-e' } } });
    merge(devF.files, { app: { service: { 'test-before.js': 'dev-f' } } });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('verifies that the correct lexigraphically sorted addons win', function () {
        expectFile('./service/in-repo.js').matches(/in-repo-b/);
        expectFile('./service/addon.js').matches(/dep-b/);
        expectFile('./service/dev-addon.js').matches(/dev-c/);
      });

      test('addons declared as dependencies should win over devDependencies', function () {
        expectFile('./service/dep-wins-over-dev.js').matches(/dep-b/);
      });

      test('in repo addons declared win over dependencies', function () {
        expectFile('./service/in-repo-over-deps.js').matches(/in-repo-a/);
      });

      test('ordering with before specified', function () {
        expectFile('./service/test-before.js').matches(/dev-d/);
      });

      test('ordering with after specified', function () {
        expectFile('./service/test-after.js').matches(/dev-b/);
      });
    });
  });

stage2Scenarios
  .map('static-with-rules', app => {
    app.addDependency('some-library', '1.0.0');
    app.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });

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
    };

    merge(app.files, {
      'ember-cli-build.js': `
        'use strict';
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');
        let opts = ${JSON.stringify(options)};
        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            babel: {
              plugins: [require.resolve('ember-auto-import/babel-plugin')]
            }
          });
          return maybeEmbroider(app, {
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
            ...opts
          });
        };
        `,
      app: {
        templates: {
          'index.hbs': `
          <HelloWorld @useDynamic="first-choice" />
          <HelloWorld @useDynamic={{"second-choice"}} />
          <HelloWorld @useDynamic={{component "third-choice"}} />
          <DirectTemplateReexport />
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

    let addon = addAddon(app, 'my-addon');
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

    let deepAddon = addAddon(addon, 'deep-addon');
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
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;
      let build: Transpiler;
      let builder: Rebuilder;

      hooks.before(async () => {
        app = await scenario.prepare();
        builder = await Rebuilder.create(app.dir, { STAGE2_ONLY: 'true' });
      });

      hooks.after(async () => {
        await builder?.shutdown();
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(builder.outputPath, '.stage2-output'), 'utf8'), {
          qunit: assert,
        });
        build = new Transpiler(expectFile.basePath);
      });

      let expectAudit = setupAuditTest(hooks, () => app.dir);

      test('index.hbs', function () {
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

      test('curly.hbs', function () {
        let assertFile = expectFile('templates/curly.hbs').transform(build.transpile);
        assertFile.matches(/import \w+ from ["']..\/components\/hello-world\.js["']/, 'explicit dependency');
        assertFile.matches(
          /import \w+ from ["'].\/components\/third-choice\.hbs["']/,
          'static component helper dependency'
        );
        assertFile.matches(/import \w+ from ["'].\/components\/first-choice\.hbs["']/, 'rule-driven string attribute');
      });

      test('hello-world.hbs', function () {
        // the point of this test is to ensure that we can transpile with no
        // warning about the dynamicComponentName.
        let assertFile = expectFile('node_modules/my-addon/templates/components/hello-world.hbs').transform(
          build.transpile
        );

        // this is a pretty trivial test, but it's needed to force the
        // transpilation to happen because transform() is lazy.
        assertFile.matches(/dynamicComponentName/);
      });

      test('addon/hello-world.js', function () {
        let assertFile = expectFile('node_modules/my-addon/components/hello-world.js').transform(build.transpile);
        assertFile.matches(
          /window\.define\(["']\my-addon\/synthetic-import-1["'],\s*function\s\(\)\s*\{\s*return\s+esc\(require\(["']\.\.\/synthetic-import-1/
        );
        assertFile.matches(
          /window\.define\(["']my-app\/templates\/components\/second-choice["'],\s*function\s\(\)\s*\{\s*return\s+esc\(require\(["']\.\.\/\.\.\/\.\.\/templates\/components\/second-choice\.hbs["']/
        );
      });

      test('app/hello-world.js', function () {
        let assertFile = expectFile('./components/hello-world.js').transform(build.transpile);
        assertFile.matches(
          /window\.define\(["']\my-addon\/synthetic-import-1["'],\s*function\s\(\)\s*\{\s*return\s+esc\(require\(["']\.\.\/node_modules\/my-addon\/synthetic-import-1/
        );

        expectAudit
          .module('./components/hello-world.js')
          .resolves('my-addon/components/hello-world')
          .to('./node_modules/my-addon/components/hello-world.js', 'remapped to precise copy of my-addon');
      });

      test('app/templates/components/direct-template-reexport.js', function () {
        expectAudit
          .module('./templates/components/direct-template-reexport.js')
          .resolves('my-addon/templates/components/hello-world')
          .to('./node_modules/my-addon/templates/components/hello-world.hbs', 'rewrites reexports of templates');
      });

      test('uses-inline-template.js', function () {
        let assertFile = expectFile('./components/uses-inline-template.js').transform(build.transpile);
        assertFile.matches(/import firstChoice from ["']\.\.\/templates\/components\/first-choice.hbs/);
        assertFile.matches(/window\.define\(["']\my-app\/templates\/components\/first-choice["']/);
      });

      test('component with relative import of arbitrarily placed template', function () {
        let assertFile = expectFile('node_modules/my-addon/components/has-relative-template.js').transform(
          build.transpile
        );
        assertFile.matches(/import layout from ["']\.\/t['"]/, 'arbitrary relative template remains the same');
      });

      test('app can import a deep addon', function () {
        expectAudit
          .module('./use-deep-addon.js')
          .resolves('deep-addon')
          .to('./node_modules/my-addon/node_modules/deep-addon/index.js');
      });

      test('amd require in an addon gets rewritten to window.require', function () {
        let assertFile = expectFile('node_modules/my-addon/components/uses-amd-require.js').transform(build.transpile);
        assertFile.matches(/window\.require\(['"]some-package['"]\)/, 'should find window.require');
      });

      test('cjs require in non-ember package does not get rewritten to window.require', function () {
        let assertFile = expectFile('node_modules/babel-filter-test4/index.js').transform(build.transpile);
        assertFile.matches(/return require\(['"]some-package['"]\)/, 'should find plain cjs require');
      });

      test('transpilation runs for ember addons', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/my-addon/components/has-relative-template.js'));
      });

      test('transpilation is skipped when package matches skipBabel', async function (assert) {
        assert.ok(!build.shouldTranspile('node_modules/babel-filter-test1/index.js'));
      });

      test('transpilation is skipped when package and version match skipBabel', async function (assert) {
        assert.ok(!build.shouldTranspile('node_modules/babel-filter-test2/index.js'));
      });

      test('transpilation runs when package version does not match skipBabel', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/babel-filter-test3/index.js'));
      });

      test('transpilation runs for non-ember package that is not explicitly skipped', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/babel-filter-test4/index.js'));
      });

      test(`app's babel plugins ran`, async function () {
        let assertFile = expectFile('custom-babel-needed.js').transform(build.transpile);
        assertFile.matches(/console\.log\(['"]embroider-sample-transforms-result['"]\)/);
      });

      test(`changes in app.css are propagated at rebuild`, async function () {
        expectFile('assets/my-app.css').doesNotMatch('newly-added-class');
        writeFileSync(join(app.dir, 'app/styles/app.css'), `.newly-added-class { color: red }`);
        await builder.build({ changedDirs: [join(app.dir, 'app/styles')] });
        expectFile('assets/my-app.css').matches('newly-added-class');
      });

      test(`public assets are included`, async function () {
        expectFile('public-file-1.txt').matches(/initial state/);
        expectFile('package.json').json().get('ember-addon.assets').includes('public-file-1.txt');
      });

      test(`updated public asset`, async function () {
        writeFileSync(join(app.dir, 'public/public-file-1.txt'), `updated state`);
        await builder.build({ changedDirs: [join(app.dir, 'app')] });

        expectFile('public-file-1.txt').matches(/updated state/);
      });

      test(`added public asset`, async function () {
        writeFileSync(join(app.dir, 'public/public-file-2.txt'), `added`);
        await builder.build({ changedDirs: [join(app.dir, 'app')] });
        expectFile('public-file-2.txt').matches(/added/);
        expectFile('package.json').json().get('ember-addon.assets').includes('public-file-2.txt');
      });

      test(`removed public asset`, async function () {
        unlinkSync(join(app.dir, 'public/public-file-1.txt'));
        await builder.build({ changedDirs: [join(app.dir, 'app')] });
        expectFile('public-file-1.txt').doesNotExist();
        expectFile('package.json').json().get('ember-addon.assets').doesNotInclude('public-file-1.txt');
      });

      test('dynamic import is preserved', function () {
        expectFile('./does-dynamic-import.js')
          .transform(build.transpile)
          .matches(/return import\(['"]some-library['"]\)/);
      });

      test('hbs transform sees expected module name', function () {
        let assertFile = expectFile('templates/components/module-name-check/index.hbs').transform(build.transpile);
        assertFile.matches(
          '"my-app/templates/components/module-name-check/index.hbs"',
          'our sample transform injected the expected moduleName into the compiled template'
        );
      });

      test('non-static other paths are included in the entrypoint', function () {
        expectFile('assets/my-app.js').matches(/i\("..\/non-static-dir\/another-library\.js"\)/);
      });

      test('static other paths are not included in the entrypoint', function () {
        expectFile('assets/my-app.js').doesNotMatch(/i\("..\/static-dir\/my-library\.js"\)/);
      });

      test('top-level static other paths are not included in the entrypoint', function () {
        expectFile('assets/my-app.js').doesNotMatch(/i\("..\/top-level-static\.js"\)/);
      });

      test('staticAppPaths do not match partial path segments', function () {
        expectFile('assets/my-app.js').matches(/i\("..\/static-dir-not-really\/something\.js"\)/);
      });
    });
  });

dummyAppScenarios
  .map('compat-stage2-addon-dummy-app', app => {
    renameApp(app, 'my-addon');
    app.linkDependency('@embroider/core', { baseDir: __dirname });
    app.linkDependency('@embroider/compat', { baseDir: __dirname });
    app.linkDependency('@embroider/webpack', { baseDir: __dirname });

    merge(app.files, {
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
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;
      let build: Transpiler;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
        build = new Transpiler(expectFile.basePath);
      });

      test('dummy app sees that its being developed', function () {
        let assertFile = expectFile('components/inside-dummy-app.js').transform(build.transpile);
        assertFile.matches(/console\.log\(true\)/);
      });

      test('addon within dummy app sees that its being developed', function () {
        let assertFile = expectFile(
          resolve.sync('my-addon/components/hello-world', {
            basedir: expectFile.basePath,
          })
        ).transform(build.transpile);
        assertFile.matches(/console\.log\(true\)/);
      });
    });
  });

function addAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDependency(addon);
  return addon;
}

function addDevAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDevDependency(addon);
  return addon;
}

function addInRepoAddon(app: Project, name: string, additionalFiles?: {}) {
  if (!app.pkg['ember-addon']) {
    app.pkg['ember-addon'] = {};
  }

  let pkg = app.pkg as any;

  if (!pkg['ember-addon'].paths) {
    pkg['ember-addon'].paths = [];
  }

  pkg['ember-addon'].paths.push(`lib/${name}`);

  merge(app.files, {
    lib: {
      [name]: {
        'package.json': JSON.stringify(
          {
            name,
            version: '0.0.0',
            keywords: ['ember-addon'],
          },
          null,
          2
        ),
        'index.js': `module.exports = {
          name: require('./package').name,
        };`,
        ...additionalFiles,
      },
    },
  });
}
