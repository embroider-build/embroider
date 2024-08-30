import { templateTests } from './helpers';

describe(`macroMaybeAttrs`, function () {
  templateTests(function (transform: (code: string) => string) {
    test('macroMaybeAttrs when true', function () {
      let code = transform(
        `<div data-test-target {{macroMaybeAttrs true data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target data-optional data-flavor=\{\{"vanilla"\}\}>/);
    });

    test('macroMaybeAttrs propagates bound paths', function () {
      let code = transform(`<div data-test-target {{macroMaybeAttrs true data-flavor=this.flavor }} ></div>`);
      expect(code).toMatch(/<div data-test-target data-flavor=\{\{this\.flavor\}\}>/);
    });

    test('macroMaybeAttrs when false', function () {
      let code = transform(
        `<div data-test-target {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target>/);
    });

    test('macroMaybeAttrs leaves other modifiers alone', function () {
      let code = transform(
        `<div data-test-target {{some-modifier this.doThing}} {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target {{some-modifier this.doThing}}/);
    });
  });
});
