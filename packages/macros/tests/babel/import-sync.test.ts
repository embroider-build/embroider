import { allBabelVersions } from './helpers';
import type { MacrosConfig } from '../../src/node';

describe('importSync', function () {
  allBabelVersions(function createTests(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { target: 'my-plugin' });
    config.finalize();

    test('importSync becomes esc(require())', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      importSync('foo');
      `);
      expect(code).toMatch(/import esc from "\.\.\/\.\.\/src\/addon\/es-compat2\.js"/);
      expect(code).toMatch(/esc\(require\(['"]foo['"]\)\)/);
      expect(code).not.toMatch(/window/);
    });
    test('importSync leaves existing binding for require alone', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      import require from 'require';
      importSync('foo');
      require('x');
      `);
      expect(code).toMatch(/esc\(require\(['"]foo['"]\)\)/);
      expect(code).toMatch(/import _require from 'require'/);
      expect(code).toMatch(/_require\(['"]x['"]\)/);
    });
    test('aliased importSync becomes require', () => {
      let code = transform(`
      import { importSync as i } from '@embroider/macros';
      i('foo');
      `);
      expect(code).toMatch(/require\(['"]foo['"]\)/);
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
      expect(code).toMatch(/require\(['"]my-plugin['"]\)/);
    });
  });
});
