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

const NAME_FROM_SNIPPET = /<(?:([^\s/]+).*>)|(?:{{\s?component\s+['"]([^'"]+)['"])|(?:\{\{([^\s]+).*\}\})/;
export function snippetToDasherizedName(snippet: string): string | undefined {
  let result = NAME_FROM_SNIPPET.exec(snippet);
  if (result) {
    return dasherize(result[1] ?? result[2] ?? result[3]);
  }
}
