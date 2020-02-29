import { allBabelVersions, runDefault } from '@embroider/test-support';
import { makeBabelConfig, allModes } from './helpers';
import { MacrosConfig } from '../..';

describe('each', function() {
  let macrosConfig: MacrosConfig;

  allBabelVersions({
    babelConfig(version: number) {
      return makeBabelConfig(version, macrosConfig);
    },
    createTests: allModes(function(transform, { buildTimeTest, applyMode, runTimeTest }) {
      beforeEach(function() {
        macrosConfig = MacrosConfig.for({});
        macrosConfig.setOwnConfig(__filename, { plugins: ['alpha', 'beta'], flavor: 'chocolate' });
        applyMode(macrosConfig);
        macrosConfig.finalize();
      });

      buildTimeTest('plugins example unrolls correctly', () => {
        let code = transform(`
      import { each, getOwnConfig, importSync } from '@embroider/macros';
      let plugins = [];
      for (let plugin of each(getOwnConfig().plugins)) {
        plugins.push(importSync(plugin));
      }
      `);
        expect(code).toMatch(/plugins\.push\(require\(["']beta['"]\)\)/);
        expect(code).toMatch(/plugins\.push\(require\(["']alpha['"]\)\)/);
        expect(code).not.toMatch(/for/);
      });

      runTimeTest('loop executes', () => {
        let code = transform(`
          import { each, getOwnConfig } from '@embroider/macros';
          export default function() {
            let plugins = [];
            for (let plugin of each(getOwnConfig().plugins)) {
              plugins.push('saw ' + plugin);
            }
            return plugins;
          }
        `);
        expect(runDefault(code)).toEqual(['saw alpha', 'saw beta']);
        expect(code).not.toMatch(/alpha/);
      });

      test('non-static array causes build error', () => {
        expect(() => {
          transform(`
        import { each } from '@embroider/macros';
        for (let plugin of each(doSomething())) {}
        `);
        }).toThrow(/the argument to the each\(\) macro must be statically known/);
      });

      test('static non-array causes build error', () => {
        expect(() => {
          transform(`
        import { each, getOwnConfig } from '@embroider/macros';
        for (let plugin of each(getOwnConfig().flavor)) {}
        `);
        }).toThrow(/the argument to the each\(\) macro must be an array/);
      });

      test('wrong arity', () => {
        expect(() => {
          transform(`
        import { each } from '@embroider/macros';
        for (let plugin of each(1,2,3)) {}
        `);
        }).toThrow(/the each\(\) macro accepts exactly one argument, you passed 3/);
      });

      test('non function call', () => {
        expect(() => {
          transform(`
        import { each } from '@embroider/macros';
        let x = each;
        `);
        }).toThrow(/the each\(\) macro can only be used within a for \.\.\. of statement/);
      });

      test('non for-of usage', () => {
        expect(() => {
          transform(`
        import { each } from '@embroider/macros';
        each(1,2,3)
        `);
        }).toThrow(/the each\(\) macro can only be used within a for \.\.\. of statement/);
      });
    }),
  });
});
