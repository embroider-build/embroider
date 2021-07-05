import { allBabelVersions } from './helpers';
import { MacrosConfig } from '../../src/node';

describe('importSync', function () {
  allBabelVersions(function createTests(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { priority: 0, config: { target: 'my-plugin' } });
    config.finalize();

    test('importSync becomes require', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      importSync('foo');
      `);
      expect(code).toMatch(/require\(['"]foo['"]\)/);
      expect(code).not.toMatch(/window/);
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
