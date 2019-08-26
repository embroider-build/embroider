// copied from https://github.com/emberjs/ember.js/blob/978cf6773d6eea3e656d0da797980305061186cf/packages/ember-template-compiler/lib/system/dasherize-component-name.ts

const SIMPLE_DASHERIZE_REGEXP = /[A-Z]|::/g;
const ALPHA = /[A-Za-z0-9]/;

export function dasherize(key: string) {
  let name = key.replace(SIMPLE_DASHERIZE_REGEXP, (char, index) => {
    if (char === '::') {
      return '/';
    }

    if (index === 0 || !ALPHA.test(key[index - 1])) {
      return char.toLowerCase();
    }

    return `-${char.toLowerCase()}`;
  });

  return name;
}
