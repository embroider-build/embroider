import { emberTemplateCompilerPath, Project } from '@embroider/test-support';
import { AppMeta, TemplateCompiler, throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { Audit, Finding } from '../src/audit';
import { join } from 'path';

describe('audit', function () {
  throwOnWarnings();

  let app: Project;

  async function audit() {
    app.writeSync();
    let audit = new Audit(join(app.root, 'audit-this-app'));
    return await audit.run();
  }

  beforeEach(async function () {
    app = new Project('audit-this-app');

    let templateCompiler = new TemplateCompiler({
      compilerPath: emberTemplateCompilerPath(),
      EmberENV: {},
      plugins: { ast: [] },
    });

    merge(app.files, {
      'index.html': `<script type="module" src="./app.js"></script>`,
      'app.js': `import Hello from './hello.hbs';`,
      'hello.hbs': ``,
      'babel_config.js': `module.exports = {
        babelrc: false,
        plugins: [],
      }`,
      'template_compiler.js': templateCompiler.serialize(),
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
      'resolvable-extensions': ['.js', '.hbs'],
      'root-url': '/',
      'template-compiler': {
        filename: 'template_compiler.js',
        isParallelSafe: true,
      },
    };
    merge(app.pkg, {
      'ember-addon': appMeta,
    });
  });

  afterAll(async function () {
    app.dispose();
  });

  test(`discovers html, js, and hbs`, async function () {
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(3);
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

  test(`tolerates CJS`, async function () {
    merge(app.files, {
      'app.js': `import thing from './uses-cjs'`,
      'uses-cjs.js': `module.exports = function() {}`,
    });
    let result = await audit();
    expect(result.findings).toEqual([]);
    expect(Object.keys(result.modules).length).toBe(3);
  });
});

function withoutCodeFrames(findings: Finding[]): Finding[] {
  return findings.map(f => {
    let result = Object.assign({}, f);
    delete result.codeFrame;
    return result;
  });
}
