import { allBabelVersions } from './helpers';
import type { MacrosConfig } from '../../src/node';

describe('importSync', function () {
  allBabelVersions(function createTests(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { target: 'my-plugin' });
    config.finalize();

    test('importSync becomes import * as _something', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      importSync('foo');
      `);
      expect(code).toMatch(/import \* as _importSync\d from "foo"/);
      expect(code).toMatch(/_importSync\d;/);
      expect(code).not.toMatch(/window/);
    });
    test('importSync leaves existing binding for require alone', () => {
      let code = transform(`
      import { importSync } from '@embroider/macros';
      import require from 'require';
      importSync('foo');
      require('x');
      `);
      expect(code).toMatch(/import \* as _importSync\d from "foo"/);
      expect(code).toMatch(/import require from 'require'/);
      expect(code).toMatch(/require\(['"]x['"]\)/);
    });
    test('aliased importSync becomes aliased variable', () => {
      let code = transform(`
      import { importSync as i } from '@embroider/macros';
      i('foo');
      `);
      expect(code).toMatch(/import \* as _i\d from "foo"/);
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
      expect(code).toMatch(/import \* as _importSync\d from "my-plugin"/);
    });
  });
});
