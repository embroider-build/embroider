import { templateTests } from './helpers';
import { MacrosConfig } from '../..';

describe(`macroIf`, function() {
  templateTests(function(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { failureMessage: 'I said so' });

    test('macroIf in content position when true', function() {
      let code = transform(`{{#macroIf true}}red{{else}}blue{{/macroIf}}`);
      expect(code).toMatch(/red/);
      expect(code).not.toMatch(/blue/);
    });

    test('macroIf in content position when false', function() {
      let code = transform(`{{#macroIf false}}red{{else}}blue{{/macroIf}}`);
      expect(code).not.toMatch(/red/);
      expect(code).toMatch(/blue/);
    });

    test('macroIf in content position when false with no alternate', function() {
      let code = transform(`{{#macroIf false}}red{{/macroIf}}`);
      expect(code).toEqual('');
    });

    test('macroIf in subexpression position when true', function() {
      let code = transform(`{{my-assertion (macroIf true 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ['"]red['"]\}\}/);
    });

    test('macroIf inside string', function() {
      let code = transform(`<div class="target {{macroIf true 'red' 'blue' }}"></div>`);
      expect(code).toMatch(/class="target \{\{['"]red['"]\}\}"/);
    });

    test('macroIf in subexpression position when false', function() {
      let code = transform(`{{my-assertion (macroIf false 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ['"]blue['"]\}\}/);
    });

    test('macroIf in subexpression position when false with no alternate', function() {
      let code = transform(`{{my-assertion (macroIf false 'red') }}`);
      expect(code).toMatch(/\{\{my-assertion undefined\}\}/);
    });

    test('macroMaybeAttrs when true', function() {
      let code = transform(
        `<div data-test-target {{macroMaybeAttrs true data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target data-optional data-flavor=\{\{"vanilla"\}\}>/);
    });

    test('macroMaybeAttrs propagates bound paths', function() {
      let code = transform(`<div data-test-target {{macroMaybeAttrs true data-flavor=this.flavor }} ></div>`);
      expect(code).toMatch(/<div data-test-target data-flavor=\{\{this\.flavor\}\}>/);
    });

    test('macroMaybeAttrs when false', function() {
      let code = transform(
        `<div data-test-target {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target>/);
    });

    test('macroMaybeAttrs leaves other modifiers alone', function() {
      let code = transform(
        `<div data-test-target {{action doThing}} {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target {{action doThing}}/);
    });

    test('macroIf composes with other macros, true case', function() {
      let code = transform(`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '3.x') 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ["']red["']\}\}/);
    });

    test('macroIf composes with other macros, false case', function() {
      let code = transform(`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '10.x') 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ["']blue["']\}\}/);
    });

    test('macroIf composes with self', function() {
      let code = transform(`{{my-assertion (macroIf true (macroIf false 'green' 'red') 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ["']red["']\}\}/);
    });
  });
});
