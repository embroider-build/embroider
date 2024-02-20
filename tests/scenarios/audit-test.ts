import { emberTemplateCompiler } from '@embroider/test-support';
import { Project, Scenarios } from 'scenario-tester';
import type { AppMeta } from '@embroider/core';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import fromPairs from 'lodash/fromPairs';
import type { Finding } from '@embroider/compat/audit';
import { Audit } from '@embroider/compat/audit';
import type { CompatResolverOptions } from '@embroider/compat/resolver-transform';
import type { Options as InlinePrecompileOptions } from 'babel-plugin-ember-template-compilation';
import { makePortable } from '@embroider/core/portable-babel-config';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from '@embroider/compat/resolver-transform';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project('audit-this-app'))
  .map('audit-tests', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: Project;

      async function audit() {
        await app.write();
        let audit = new Audit(app.baseDir);
        return await audit.run();
      }

      hooks.beforeEach(async function () {
        app = new Project('audit-this-app');

        const resolvableExtensions = ['.js', '.hbs'];

        let resolverConfig: CompatResolverOptions = {
          amdCompatibility: 'cjs',
          appRoot: app.baseDir,
          modulePrefix: 'audit-this-app',
          options: {
            staticComponents: true,
            staticHelpers: true,
            staticModifiers: true,
            allowUnsafeDynamicComponents: false,
          },
          activePackageRules: [],
          renamePackages: {},
          renameModules: {},
          engines: [
            {
              packageName: 'audit-this-app',
              fastbootFiles: {},
              activeAddons: [],
              root: app.baseDir,
            },
          ],
          resolvableExtensions,
        };

        let babel: any = {
          babelrc: false,
          plugins: [],
        };

        let transformOpts: ResolverTransformOptions = {
          appRoot: resolverConfig.appRoot,
        };
        let transform: Transform = [require.resolve('@embroider/compat/resolver-transform'), transformOpts];

        let etcOptions: InlinePrecompileOptions = {
          compilerPath: emberTemplateCompiler().path,
          transforms: [transform],
          enableLegacyModules: ['ember-cli-htmlbars'],
        };
        babel.plugins!.push([require.resolve('babel-plugin-ember-template-compilation'), etcOptions]);

        merge(app.files, {
          'index.html': `<script type="module" src="./app.js"></script>`,
          'app.js': `import Hello from './hello.hbs';`,
          'hello.hbs': ``,
          'babel_config.js': `module.exports = ${JSON.stringify(
            makePortable(babel, { basedir: '.' }, []).config,
            null,
            2
          )}`,
          node_modules: {
            '.embroider': {
              'resolver.json': JSON.stringify(resolverConfig),
            },
          },
        });
        let appMeta: AppMeta = {
          type: 'app',
          version: 2,
          assets: ['index.html'],
          babel: {
            filename: 'babel_config.js',
            isParallelSafe: true,
            majorVersion: 7,
            fileFilter: 'babel_filter.js',
          },
          'root-url': '/',
          'auto-upgraded': true,
        };
        merge(app.pkg, {
          'ember-addon': appMeta,
          keywords: ['ember-addon'],
        });
      });

      hooks.after(async function () {
        app.dispose();
      });

      test(`discovers html, js, and hbs`, async function (assert) {
        let result = await audit();
        assert.deepEqual(result.findings, []);
        assert.deepEqual(Object.keys(result.modules), [
          './index.html',
          './app.js',
          './hello.hbs',
          '/@embroider/ext-cjs/@ember/template-factory',
        ]);
      });

      test(`reports resolution failures`, async function (assert) {
        merge(app.files, {
          'app.js': `
        import { a, b } from './unknown';
      `,
        });
        let result = await audit();
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            filename: './app.js',
            message: 'unable to resolve dependency',
            detail: './unknown',
          },
        ]);
        assert.ok(result.findings[0]?.codeFrame);
        assert.equal(Object.keys(result.modules).length, 2);
      });

      test(`ignores absolute URLs in script tags`, async function (assert) {
        merge(app.files, {
          'index.html': `<script type="module" src="https://example.com/foo.js"></script>`,
        });
        let result = await audit();
        assert.deepEqual(result.findings, []);
        assert.equal(Object.keys(result.modules).length, 1);
      });

      test(`finds misuse of ES module namespace`, async function (assert) {
        merge(app.files, {
          'app.js': `
        import thing from './lib';
        thing.hello();
      `,
          'lib.js': `
        export function hello() {}
      `,
        });
        let result = await audit();
        let backtick = '`';
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            filename: './app.js',
            message: 'importing a non-existent default export',
            detail: `"./lib" has no default export. Did you mean ${backtick}import * as thing from "./lib"${backtick}?`,
          },
        ]);
        assert.ok(result.findings[0]?.codeFrame);
        assert.deepEqual(Object.keys(result.modules).length, 3);
      });

      test(`finds use of missing named export`, async function (assert) {
        merge(app.files, {
          'app.js': `
        import { goodbye } from './lib';
        goodbye();
      `,
          'lib.js': `
        export function hello() {}
      `,
        });
        let result = await audit();
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            filename: './app.js',
            message: 'importing a non-existent named export',
            detail: `"./lib" has no export named "goodbye".`,
          },
        ]);
        assert.ok(result.findings[0]?.codeFrame);
        assert.deepEqual(Object.keys(result.modules).length, 3);
      });

      test(`finds all named exports`, async function (assert) {
        merge(app.files, {
          'app.js': `
        function a() {}
        export { a }
        export function b() {}
        export class c {}
        export { a as d };
        export const e = 1;
        let thing1 = 1;
        export const {
          f,
          prop1: [g,, ...h],  // the double comma here is intentional
          prop2: { i },
          j2: j
        } = foo(), k = 1;
        export const l = (function(){
          let { interior1 } = foo();
          function interior2() {};
          class interior3 {}
          return interior;
        })();
        export const { m=thing1 } = foo();
        export const [ n=(function(){
          let { interior4 } = foo();
          return interior4;
        })() ] = foo();
      `,
        });
        let result = await audit();
        assert.deepEqual(result.findings, []);
        let exports = result.modules['./app.js'].exports;
        assert.ok(exports.includes('a'));
        assert.ok(exports.includes('b'));
        assert.ok(exports.includes('c'));
        assert.ok(exports.includes('d'));
        assert.ok(exports.includes('e'));
        assert.ok(exports.includes('f'));
        assert.ok(exports.includes('g'));
        assert.ok(exports.includes('h'));
        assert.ok(exports.includes('i'));
        assert.ok(exports.includes('j'));
        assert.ok(exports.includes('k'));
        assert.ok(exports.includes('l'));
        assert.ok(exports.includes('m'));
        assert.ok(exports.includes('n'));
        assert.ok(!exports.includes('prop1'));
        assert.ok(!exports.includes('prop2'));
        assert.ok(!exports.includes('j2'));
        assert.ok(!exports.includes('interior1'));
        assert.ok(!exports.includes('interior2'));
        assert.ok(!exports.includes('interior3'));
        assert.ok(!exports.includes('thing1'));
      });

      test(`finds all re-exports`, async function (assert) {
        merge(app.files, {
          'app.js': `
        export { default as a, b, thing as c } from './lib-a';
        export * from './lib-b';
        export * as libC from './lib-c';
      `,
          'lib-a.js': `
        export default function() {}
        export function b() {}
        export function thing() {}
      `,
          'lib-b.js': `
        export const alpha = 1;
        export class beta {}
      `,
          'lib-c.js': `
        export function whatever() {}
      `,
        });

        let result = await audit();
        assert.deepEqual(result.findings, []);
        let exports = result.modules['./app.js'].exports;
        assert.ok(exports.includes('a'));
        assert.ok(exports.includes('b'));
        assert.ok(!exports.includes('thing'));
        assert.ok(exports.includes('c'));
        assert.ok(exports.includes('alpha'));
        assert.ok(exports.includes('beta'));
        assert.ok(exports.includes('libC'));
        assert.equal(result.modules['./app.js'].imports.length, 3);
        let imports = fromPairs(result.modules['./app.js'].imports.map(imp => [imp.source, imp.specifiers]));
        assert.deepEqual(imports, {
          './lib-a': [
            { name: 'default', local: null },
            { name: 'b', local: null },
            { name: 'thing', local: null },
          ],
          './lib-b': [{ name: { isNamespace: true }, local: null }],
          './lib-c': [{ name: { isNamespace: true }, local: null }],
        });
        assert.equal(Object.keys(result.modules).length, 5);
      });

      test(`tolerates CJS`, async function (assert) {
        merge(app.files, {
          'app.js': `import thing from './uses-cjs'`,
          'uses-cjs.js': `module.exports = function() {}`,
        });
        let result = await audit();
        assert.deepEqual(result.findings, []);
        assert.equal(Object.keys(result.modules).length, 3);
      });

      test(`tolerates AMD`, async function (assert) {
        merge(app.files, {
          'app.js': `import thing from './uses-amd'`,
          'uses-amd.js': `define('myself', [], function() {})`,
        });
        let result = await audit();
        assert.deepEqual(result.findings, []);
        assert.equal(Object.keys(result.modules).length, 3);
      });

      test(`tolerates @embroider/macros`, async function (assert) {
        merge(app.files, {
          'app.js': `import { dependencySatisfies } from '@embroider/macros'`,
        });
        let result = await audit();
        assert.deepEqual(result.findings, []);
        assert.equal(Object.keys(result.modules).length, 2);
      });

      test('finds missing component in standalone hbs', async function (assert) {
        merge(app.files, {
          'hello.hbs': `<NoSuchThing />`,
        });
        let result = await audit();
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            message: 'unable to resolve dependency',
            detail: '#embroider_compat/components/no-such-thing',
            filename: './hello.hbs',
          },
        ]);
      });

      test('finds missing component in inline hbs', async function (assert) {
        merge(app.files, {
          'app.js': `
        import { hbs } from 'ember-cli-htmlbars';
        hbs("<NoSuchThing />");
      `,
        });
        let result = await audit();
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            message: 'unable to resolve dependency',
            detail: '#embroider_compat/components/no-such-thing',
            filename: './app.js',
          },
        ]);
      });

      test('traverse through template even when it has some errors', async function (assert) {
        merge(app.files, {
          'hello.hbs': `<NoSuchThing /><Second />`,
          components: {
            'second.js': `
          export default class {}
        `,
          },
        });
        let result = await audit();
        assert.deepEqual(withoutCodeFrames(result.findings), [
          {
            message: 'unable to resolve dependency',
            detail: '#embroider_compat/components/no-such-thing',
            filename: './hello.hbs',
          },
        ]);
        assert.ok(Object.keys(result.modules).includes('./components/second.js'));
      });

      test('failure to parse JS is reported and does not cause cascading errors', async function (assert) {
        merge(app.files, {
          'app.js': `import { thing } from './intermediate'`,
          'intermediate.js': `export * from './has-parse-error';`,
          'has-parse-error.js': `export default function() {`,
        });
        let result = await audit();
        assert.deepEqual(
          result.findings.map(f => ({ filename: f.filename, message: f.message })),
          [{ filename: './has-parse-error.js', message: 'failed to parse' }]
        );
        assert.equal(Object.keys(result.modules).length, 4);
      });

      test('failure to parse HBS is reported and does not cause cascading errors', async function (assert) {
        merge(app.files, {
          'hello.hbs': `{{broken`,
        });
        let result = await audit();
        assert.deepEqual(
          result.findings.map(f => ({ filename: f.filename, message: f.message })),
          [{ filename: './hello.hbs', message: 'failed to parse' }]
        );
        assert.equal(Object.keys(result.modules).length, 3);
      });
    });
  });

function withoutCodeFrames(findings: Finding[]): Finding[] {
  return findings.map(f => {
    let result = Object.assign({}, f);
    delete result.codeFrame;
    return result;
  });
}
