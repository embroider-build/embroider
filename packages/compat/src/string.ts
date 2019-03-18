// copied from @ember/string. Unfortunately that code is not really published in
// a NodeJS clean way.

const STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;

export function decamelize(str: string) {
  return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
}

const STRING_DASHERIZE_REGEXP = /[ _]/g;

export function dasherize(key: string) {
  return decamelize(key).replace(STRING_DASHERIZE_REGEXP, '-');
}
