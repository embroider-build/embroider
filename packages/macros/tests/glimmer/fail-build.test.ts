import { templateTests } from './helpers';
import { MacrosConfig } from '../..';

describe(`macroFailBuild`, function() {
  templateTests(function(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { failureMessage: 'I said so' });
    config.finalize();

    test('it can fail the build, content position', () => {
      expect(() => {
        transform(`
          {{macroFailBuild "This is a deliberate build failure"}};
        `);
      }).toThrow(/This is a deliberate build failure/);
    });

    test('it can fail the build, subexpression position', () => {
      expect(() => {
        transform(`
          {{thing (macroFailBuild "This is a deliberate build failure") }};
        `);
      }).toThrow(/This is a deliberate build failure/);
    });

    test('the failure message can incorporate other macro output', () => {
      expect(() => {
        transform(`
          {{macroFailBuild "failing because %s" (macroGetOwnConfig "failureMessage") }};
        `);
      }).toThrow(/failing because I said so/);
    });

    test('it does not fail the build when its inside a dead branch', () => {
      let code = transform(`
        {{if (macroCondition true) someValue (macroFailBuild 'not supposed to happen')}}
      }
      `);
      expect(code).toMatch(/\{\{someValue\}\}/);
    });
  });
});
