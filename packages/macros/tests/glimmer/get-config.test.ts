import { templateTests } from './helpers';
import type { MacrosConfig } from '../../src/node';

describe(`macroGetConfig`, function () {
  templateTests(function (transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, {
      mode: 'amazing',
      count: 42,
      inner: {
        items: [{ name: 'Arthur', awesome: true }],
        description: null,
      },
    });

    config.setConfig(__filename, 'scenario-tester', {
      color: 'orange',
    });

    config.finalize();

    test('macroGetOwnConfig in content position', function () {
      let code = transform(`{{macroGetOwnConfig "mode"}}`);
      expect(code).toMatch(/\{\{["']amazing["']\}\}/);
    });

    test('macroGetConfig in content position', function () {
      let code = transform(`{{macroGetConfig "scenario-tester" "color"}}`);
      expect(code).toMatch(/\{\{["']orange["']\}\}/);
    });

    test('macroGetOwnConfig in subexpression position', function () {
      let code = transform(`{{#let (macroGetOwnConfig "mode") as |m|}}{{m}}{{/let}}`);
      expect(code).toMatch(/\{\{#with ["']amazing["'] as |m|\}\}/);
    });

    test('macroGetConfig in subexpression position', function () {
      let code = transform(`{{#let (macroGetConfig "scenario-tester" "color") as |m|}}{{m}}{{/let}}`);
      expect(code).toMatch(/\{\{#with ["']orange["'] as |m|\}\}/);
    });

    test('macroGetOwnConfig emits number', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig "count") }}`);
      expect(code).toMatch(/\{\{my-assertion 42\}\}/);
    });

    test('macroGetOwnConfig emits boolean', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig "inner" "items" "0" "awesome") }}`);
      expect(code).toMatch(/\{\{my-assertion true\}\}/);
    });

    test('macroGetOwnConfig emits string', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig "mode") }}`);
      expect(code).toMatch(/\{\{my-assertion ['"]amazing['"]\}\}/);
    });

    test('macroGetOwnConfig emits null', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig "inner" "description") }}`);
      expect(code).toMatch(/\{\{my-assertion null\}\}/);
    });

    test('macroGetOwnConfig emits complex pojo', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig) }}`);
      expect(code).toMatch(
        /\{\{my-assertion \(hash mode=["']amazing["'] count=42 inner=\(hash items=\(array \(hash name=["']Arthur["'] awesome=true\)\) description=null\)\)\}\}/
      );
    });

    test('macroGetOwnConfig emits undefined for missing key', function () {
      let code = transform(`{{my-assertion (macroGetOwnConfig "inner" "notAThing") }}`);
      expect(code).toMatch(/\{\{my-assertion undefined\}\}/);
    });

    test('macroGetConfig emits undefined for missing config', function () {
      let code = transform(`{{my-assertion (macroGetConfig "code-equality-assertions") }}`);
      expect(code).toMatch(/\{\{my-assertion undefined\}\}/);
    });
  });
});
