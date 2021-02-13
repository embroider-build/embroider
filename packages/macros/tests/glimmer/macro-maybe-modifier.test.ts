import { templateTests } from './helpers';

describe(`macroMaybeModifier`, function () {
  templateTests(function (transform: (code: string) => string) {
    test('macroMaybeModifier when true', function () {
      let code = transform(`<button {{macroMaybeModifier true on "click" this.submit}} ></button>`);
      expect(code).toMatch(/<button {{on "click" this.submit}}>/);
    });

    test('macroMaybeModifier propagates named args', function () {
      let code = transform(`<button {{macroMaybeModifier true on "click" this.submit passive=true}} ></button>`);
      expect(code).toMatch(/<button {{on "click" this.submit passive=true}}>/);
    });

    test('macroMaybeModifier propagates bound paths', function () {
      let code = transform(
        `<button {{macroMaybeModifier true on this.event this.submit passive=this.passive}} ></button>`
      );
      expect(code).toMatch(/<button {{on this.event this.submit passive=this.passive}}>/);
    });

    test('macroMaybeModifier when false', function () {
      let code = transform(`<button {{macroMaybeModifier false on "click" this.submit}} ></button>`);
      expect(code).toMatch(/<button>/);
    });

    test('macroMaybeModifier leaves other modifiers alone', function () {
      let code = transform(
        `<button {{macroMaybeModifier false on "click" this.submit}} {{style color="red"}}></button>`
      );

      expect(code).toMatch(/<button {{style color="red"}}>/);
    });
  });
});
