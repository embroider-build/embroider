import { describe, expect, test } from 'vitest';

import { allBabelVersions, runDefault } from './helpers';
import type { MacrosConfig } from '../../src/node';

describe(`fail build macro`, function () {
  allBabelVersions(function (transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { failureMessage: 'I said so' });
    config.finalize();

    test('it can fail the build', () => {
      expect(() => {
        transform(`
          import { failBuild } from '@embroider/macros';
          failBuild("This is a deliberate build failure");
        `);
      }).toThrow(/This is a deliberate build failure/);
    });

    test('the failure message can incorporate other macro output', () => {
      expect(() => {
        transform(`
          import { failBuild, getOwnConfig } from '@embroider/macros';
          failBuild("failing because %s", getOwnConfig().failureMessage);
        `);
      }).toThrow(/failing because I said so/);
    });

    test('it does not fail the build when its inside a dead branch', () => {
      let code = transform(`
      import { macroCondition, failBuild } from '@embroider/macros';
      export default function() {
        if (macroCondition(true)) {
          return 'it works';
        } else {
          failBuild('not supposed to happen');
        }
      }
      `);
      expect(runDefault(code)).toEqual('it works');
    });

    test('non call error', () => {
      expect(() => {
        transform(`
          import { failBuild } from '@embroider/macros';
          let x = failBuild;
        `);
      }).toThrow(/You can only use failBuild as a function call/);
    });
  });
});
