import { templateTests } from './helpers';
import { MacrosConfig } from '../..';

describe(`macroFailBuild`, function() {
  templateTests(function(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { failureMessage: 'I said so' });

    test.skip('it can fail the build', () => {
      expect(() => {
        transform(`
          {{macroFailBuild "This is a deliberate build failure"}};
        `);
      }).toThrow(/This is a deliberate build failure/);
    });

    test.skip('the failure message can incorporate other macro output', () => {
      expect(() => {
        transform(`
          {{macroFailBuild "failing because %s" (getOwnConfig "failureMessage") }};
        `);
      }).toThrow(/failing because I said so/);
    });

    test('it does not fail the build when its inside a dead branch', () => {
      let code = transform(`
        {{macroIf true someValue (macroFailBuild 'not supposed to happen')}}
      }
      `);
      expect(code).toMatch(/\{\{someValue\}\}/);
    });
  });
});
