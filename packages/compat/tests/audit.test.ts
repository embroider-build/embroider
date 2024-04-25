import { emberTemplateCompiler } from '@embroider/test-support';
import { Project } from 'scenario-tester';
import type { AppMeta } from '@embroider/core';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import fromPairs from 'lodash/fromPairs';
import { Audit } from '../src/audit';
import type { CompatResolverOptions } from '../src/resolver-transform';
import type { TransformOptions } from '@babel/core';
import type { Options as InlinePrecompileOptions } from 'babel-plugin-ember-template-compilation';
import { makePortable } from '@embroider/core/src/portable-babel-config';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from '../src/resolver-transform';

describe('audit', function () {
  throwOnWarnings();

  let app: Project;

  async function audit() {
    await app.write();
    let audit = new Audit(app.baseDir);
    return await audit.run();
  }

  beforeEach(async function () {
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
          isLazy: false,
        },
      ],
      resolvableExtensions,
    };

    let babel: TransformOptions = {
      babelrc: false,
      plugins: [],
    };

    let transformOpts: ResolverTransformOptions = {
      appRoot: resolverConfig.appRoot,
    };
    let transform: Transform = [require.resolve('../src/resolver-transform'), transformOpts];

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

  afterAll(async function () {
    app.dispose();
  });

  test(`discovers html, js, and hbs`, async function () {
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules)).toEqual([
      './index.html',
      './app.js',
      './hello.hbs',
      '/@embroider/ext-cjs/@ember/template-factory',
    ]);
  });

  test(`reports resolution failures`, async function () {
    merge(app.files, {
      'app.js': `
        import { a, b } from './unknown';
      `,
    });
    let result = await audit();
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        filename: './app.js',
        message: 'unable to resolve dependency',
        detail: './unknown',
      },
    ]);
    expect(result.findings[0]?.codeFrame).toBeDefined();
    expect(Object.keys(result.modules).length).toBe(2);
  });

  test(`ignores absolute URLs in script tags`, async function () {
    merge(app.files, {
      'index.html': `<script type="module" src="https://example.com/foo.js"></script>`,
    });
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(1);
  });

  test(`finds misuse of ES module namespace`, async function () {
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
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        filename: './app.js',
        message: 'importing a non-existent default export',
        detail: `"./lib" has no default export. Did you mean ${backtick}import * as thing from "./lib"${backtick}?`,
      },
    ]);
    expect(result.findings[0]?.codeFrame).toBeDefined();
    expect(Object.keys(result.modules).length).toEqual(3);
  });

  test(`finds use of missing named export`, async function () {
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
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        filename: './app.js',
        message: 'importing a non-existent named export',
        detail: `"./lib" has no export named "goodbye".`,
      },
    ]);
    expect(result.findings[0]?.codeFrame).toBeDefined();
    expect(Object.keys(result.modules).length).toEqual(3);
  });

  test(`finds all named exports`, async function () {
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
    expect(result.findings).toEqual([]);
    let exports = result.modules['./app.js'].exports;
    expect(exports).toContain('a');
    expect(exports).toContain('b');
    expect(exports).toContain('c');
    expect(exports).toContain('d');
    expect(exports).toContain('e');
    expect(exports).toContain('f');
    expect(exports).toContain('g');
    expect(exports).toContain('h');
    expect(exports).toContain('i');
    expect(exports).toContain('j');
    expect(exports).toContain('k');
    expect(exports).toContain('l');
    expect(exports).toContain('m');
    expect(exports).toContain('n');
    expect(exports).not.toContain('prop1');
    expect(exports).not.toContain('prop2');
    expect(exports).not.toContain('j2');
    expect(exports).not.toContain('interior1');
    expect(exports).not.toContain('interior2');
    expect(exports).not.toContain('interior3');
    expect(exports).not.toContain('thing1');
  });

  test(`finds all re-exports`, async function () {
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
    expect(result.findings).toEqual([]);
    let exports = result.modules['./app.js'].exports;
    expect(exports).toContain('a');
    expect(exports).toContain('b');
    expect(exports).not.toContain('thing');
    expect(exports).toContain('c');
    expect(exports).toContain('alpha');
    expect(exports).toContain('beta');
    expect(exports).toContain('libC');
    expect(result.modules['./app.js'].imports.length).toBe(3);
    let imports = fromPairs(result.modules['./app.js'].imports.map(imp => [imp.source, imp.specifiers]));
    expect(withoutCodeFrames(imports)).toEqual({
      './lib-a': [
        { name: 'default', local: null },
        { name: 'b', local: null },
        { name: 'thing', local: null },
      ],
      './lib-b': [{ name: { isNamespace: true }, local: null }],
      './lib-c': [{ name: { isNamespace: true }, local: null }],
    });
    expect(Object.keys(result.modules).length).toBe(5);
  });

  test(`tolerates CJS`, async function () {
    merge(app.files, {
      'app.js': `import thing from './uses-cjs'`,
      'uses-cjs.js': `module.exports = function() {}`,
    });
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(3);
  });

  test(`tolerates AMD`, async function () {
    merge(app.files, {
      'app.js': `import thing from './uses-amd'`,
      'uses-amd.js': `define('myself', [], function() {})`,
    });
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(3);
  });

  test(`tolerates @embroider/macros`, async function () {
    merge(app.files, {
      'app.js': `import { dependencySatisfies } from '@embroider/macros'`,
    });
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(2);
  });

  test('finds missing component in standalone hbs', async function () {
    merge(app.files, {
      'hello.hbs': `<NoSuchThing />`,
    });
    let result = await audit();
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        message: 'unable to resolve dependency',
        detail: '#embroider_compat/components/no-such-thing',
        filename: './hello.hbs',
      },
    ]);
  });

  test('finds missing component in inline hbs', async function () {
    merge(app.files, {
      'app.js': `
        import { hbs } from 'ember-cli-htmlbars';
        hbs("<NoSuchThing />");
      `,
    });
    let result = await audit();
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        message: 'unable to resolve dependency',
        detail: '#embroider_compat/components/no-such-thing',
        filename: './app.js',
      },
    ]);
  });

  test('traverse through template even when it has some errors', async function () {
    merge(app.files, {
      'hello.hbs': `<NoSuchThing /><Second />`,
      components: {
        'second.js': `
          export default class {}
        `,
      },
    });
    let result = await audit();
    expect(withoutCodeFrames(result.findings)).toEqual([
      {
        message: 'unable to resolve dependency',
        detail: '#embroider_compat/components/no-such-thing',
        filename: './hello.hbs',
      },
    ]);
    expect(Object.keys(result.modules)).toContain('./components/second.js');
  });

  test('failure to parse JS is reported and does not cause cascading errors', async function () {
    merge(app.files, {
      'app.js': `import { thing } from './intermediate'`,
      'intermediate.js': `export * from './has-parse-error';`,
      'has-parse-error.js': `export default function() {`,
    });
    let result = await audit();
    expect(result.findings.map(f => ({ filename: f.filename, message: f.message }))).toEqual([
      { filename: './has-parse-error.js', message: 'failed to parse' },
    ]);
    expect(Object.keys(result.modules).length).toBe(4);
  });

  test('failure to parse HBS is reported and does not cause cascading errors', async function () {
    merge(app.files, {
      'hello.hbs': `{{broken`,
    });
    let result = await audit();
    expect(result.findings.map(f => ({ filename: f.filename, message: f.message }))).toEqual([
      { filename: './hello.hbs', message: 'failed to parse' },
    ]);
    expect(Object.keys(result.modules).length).toBe(3);
  });
});

function withoutCodeFrames<T extends { codeFrameIndex?: any }>(modules: Record<string, T[]>): Record<string, T[]>;
function withoutCodeFrames<T extends { codeFrame?: any }>(findings: T[]): T[];
function withoutCodeFrames<T extends { codeFrameIndex?: any }, U extends { codeFrame?: any }>(
  input: Record<string, T[]> | U[]
): Record<string, T[]> | U[] {
  if (Array.isArray(input)) {
    return input.map(f => {
      let result = Object.assign({}, f);
      delete result.codeFrame;
      return result;
    });
  }
  const result: Record<string, T[]> = {};

  const knownInput = input;

  for (let item in knownInput) {
    result[item] = knownInput[item].map(i => ({ ...i, codeFrameIndex: undefined }));
  }

  return result;
}
