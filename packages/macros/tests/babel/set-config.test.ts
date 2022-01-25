import { MacrosConfig } from '../../src/node';
import { allBabelVersions } from './helpers';

describe(`setConfig`, function () {
  allBabelVersions(function () {
    test('works with empty config', () => {
      let config = {};

      let macroConfig = MacrosConfig.for({}, __dirname);
      macroConfig.setConfig(__filename, 'qunit', config);
    });

    test('works with POJO config', () => {
      let config = {
        str: 'yes',
        num: 10,
        bool: true,
        undef: undefined,
        nil: null,
        arr: ['yes', 10, true, undefined, null, { inArr: true }],
        obj: { nested: true },
      };

      let macroConfig = MacrosConfig.for({}, __dirname);
      macroConfig.setConfig(__filename, 'qunit', config);
    });

    test('throws for non-serializable config', () => {
      let config = {
        obj: {
          regex: /regex/,
        },
      };

      let macroConfig = MacrosConfig.for({}, __dirname);

      expect(() => macroConfig.setConfig(__filename, 'qunit', config)).toThrow(
        `[Embroider:MacrosConfig] the given config from '${__filename}' for packageName 'qunit' is not JSON serializable.`
      );
    });
  });
});
