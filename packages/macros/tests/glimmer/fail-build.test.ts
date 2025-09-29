import { templateTests } from './helpers';
import type { MacrosConfig } from '../../src/node';

describe(`macroFailBuild`, function () {
  templateTests(function (originalTransform) {
    function configure(config: MacrosConfig) {
      config.setOwnConfig(__filename, { failureMessage: 'I said so' });
      config.finalize();
    }

    async function transform(text: string): Promise<string> {
      return originalTransform(text, { configure });
    }

    test('it can fail the build, content position', async () => {
      await expect(async () => {
        await transform(`
          {{macroFailBuild "This is a deliberate build failure"}};
        `);
      }).rejects.toThrow(/This is a deliberate build failure/);
    });

    test('it can fail the build, subexpression position', async () => {
      await expect(async () => {
        await transform(`
          {{thing (macroFailBuild "This is a deliberate build failure") }};
        `);
      }).rejects.toThrow(/This is a deliberate build failure/);
    });

    test('the failure message can incorporate other macro output', async () => {
      await expect(async () => {
        await transform(`
          {{macroFailBuild "failing because %s" (macroGetOwnConfig "failureMessage") }};
        `);
      }).rejects.toThrow(/failing because I said so/);
    });

    test('it does not fail the build when its inside a dead branch', async () => {
      let code = await transform(`
        {{if (macroCondition true) someValue (macroFailBuild 'not supposed to happen')}}
      }
      `);
      expect(code).toMatch(/\{\{someValue\}\}/);
    });
  });
});
