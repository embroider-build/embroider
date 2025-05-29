import { templateTests } from './helpers';

describe(`macroMaybeAttrs`, function () {
  templateTests(function (transform: (code: string) => Promise<string>) {
    test('macroMaybeAttrs when true', async function () {
      let code = await transform(
        `<div data-test-target {{macroMaybeAttrs true data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target data-optional data-flavor=\{\{"vanilla"\}\}>/);
    });

    test('macroMaybeAttrs propagates bound paths', async function () {
      let code = await transform(`<div data-test-target {{macroMaybeAttrs true data-flavor=this.flavor }} ></div>`);
      expect(code).toMatch(/<div data-test-target data-flavor=\{\{this\.flavor\}\}>/);
    });

    test('macroMaybeAttrs when false', async function () {
      let code = await transform(
        `<div data-test-target {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target>/);
    });

    test('macroMaybeAttrs leaves other modifiers alone', async function () {
      let code = await transform(
        `<div data-test-target {{action this.doThing}} {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
      );
      expect(code).toMatch(/<div data-test-target {{action this.doThing}}/);
    });
  });
});
