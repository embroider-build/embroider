import { allBabelVersions } from './helpers';
import type { Transform } from '@embroider/test-support';
import type { MacrosConfig } from '../../src/node';

// the keys of the object literal that importSync's eager mode expands to
function lookupKeys(code: string): string[] {
  return [...code.matchAll(/"([^"]+)": esc\(/g)].map(m => m[1]);
}

describe('importSync', function () {
  allBabelVersions(function createTests(transform: Transform, config: MacrosConfig) {
    config.setOwnConfig(__filename, { target: 'my-plugin' });
    config.importSyncImplementation = 'eager';
    config.finalize();

    test('importSync becomes import * as _something', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      importSync('foo');
      `);
      expect(code).toMatch(/import \* as _importSync\d* from "foo"/);
      expect(code).toMatch(/esc\(_importSync\d*\);/);
      expect(code).not.toMatch(/window/);
    });
    test('importSync leaves existing binding for require alone', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      import require from 'require';
      importSync('foo');
      require('x');
      `);
      expect(code).toMatch(/import \* as _importSync\d* from "foo"/);
      expect(code).toMatch(/import require from 'require'/);
      expect(code).toMatch(/require\(['"]x['"]\)/);
    });
    test('aliased importSync becomes aliased variable', () => {
      let code = transform(`
      import { importSync as i } from '@embroider/macros';
      i('foo');
      `);
      expect(code).toMatch(/import \* as _i\d* from "foo"/);
      expect(code).not.toMatch(/window/);
    });
    test('import of importSync itself gets removed', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      `);
      expect(code).toEqual('');
    });
    test('require becomes window.require', () => {
      let code = transform(`
      require('foo');
      `);
      expect(code).toMatch(/window\.require\(['"]foo['"]\)/);
    });
    test('importSync accepts a macro-expanded argument', () => {
      let code = transform(`
      import { importSync, getOwnConfig } from '@embroider/macros';
      importSync(getOwnConfig().target);
      `);
      expect(code).toMatch(/import \* as _importSync\d* from "my-plugin"/);
    });
    test('importSync accepts template argument with dynamic part', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      function getFile(file) {
        return importSync(\`./fixtures/results/\${file}\`).default;
      }
      `);
      expect(lookupKeys(code)).toEqual([
        'chart-result',
        'fact-result',
        'helper',
        'pre-alpha',
        'pre-beta',
        'task-result',
      ]);
      // a bare interpolation indexes with the expression itself, exactly as it
      // did before we understood the rest of the pattern
      expect(code).toMatch(/\}\[file\]\.default/);
      expect(code).toMatchSnapshot();
    });
    test('importSync template argument keeps static text after the interpolation', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      function getResult(type) {
        return importSync(\`./fixtures/results/\${type}-result\`).default;
      }
      `);
      // only the entries the pattern can actually select
      expect(lookupKeys(code)).toEqual(['chart-result', 'fact-result', 'task-result']);
      expect(code).toMatchSnapshot();
    });
    test('importSync template argument tolerates a file extension', () => {
      let withExtension = transform(`
      import { importSync } from '@embroider/macros';
      function getResult(type) {
        return importSync(\`./fixtures/results/\${type}-result.js\`).default;
      }
      `);
      let withoutExtension = transform(`
      import { importSync } from '@embroider/macros';
      function getResult(type) {
        return importSync(\`./fixtures/results/\${type}-result\`).default;
      }
      `);
      expect(withExtension).toEqual(withoutExtension);
    });
    test('importSync template argument supports static text before the interpolation', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      function getPre(name) {
        return importSync(\`./fixtures/results/pre-\${name}\`).default;
      }
      `);
      expect(lookupKeys(code)).toEqual(['pre-alpha', 'pre-beta']);
      expect(code).toMatchSnapshot();
    });
    test('importSync collapses entries that differ only by extension', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      function getChart(name) {
        return importSync(\`./fixtures/results/chart-\${name}\`).default;
      }
      `);
      // chart-result.hbs and chart-result.js are colocated, and both resolve
      // through the same extension-less import
      expect(lookupKeys(code)).toEqual(['chart-result']);
      expect(code).toMatch(/from "\.\/fixtures\/results\/chart-result"/);
    });
    test('importSync accepts a concat expression with trailing static text', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      function getResult(type) {
        return importSync("./fixtures/results/".concat(type, "-result")).default;
      }
      `);
      expect(lookupKeys(code)).toEqual(['chart-result', 'fact-result', 'task-result']);
    });
    test('importSync accepts a template literal with no interpolations', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      importSync(\`foo\`);
      `);
      expect(code).toMatch(/import \* as _importSync\d* from "foo"/);
      expect(code).toMatch(/esc\(_importSync\d*\);/);
    });
    test('importSync rejects a directory that is not statically known', () => {
      expect(() => {
        transform(`
        import { importSync } from '@embroider/macros';
        function getResult(dir, type) {
          return importSync(\`./fixtures/\${dir}/\${type}-result\`).default;
        }
        `);
      }).toThrow(/importSync eager mode only supports dynamic paths which are relative/);
    });
    test('importSync rejects a non-relative dynamic path', () => {
      expect(() => {
        transform(`
        import { importSync } from '@embroider/macros';
        function getResult(type) {
          return importSync(\`some-package/results/\${type}\`).default;
        }
        `);
      }).toThrow(/importSync eager mode only supports dynamic paths which are relative/);
    });
  });
});
