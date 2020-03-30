// These functions are taken from https://github.com/ember-cli/ember-cli/commit/098a9b304b551fe235bd42399ce6975af2a1bc48
// and are used to ensure the correct order of dependency addons.

export function lexicographically(a: string, b: string): number {
  const aIsString = typeof a === 'string';
  const bIsString = typeof b === 'string';

  if (aIsString && bIsString) {
    return a.localeCompare(b);
  } else if (aIsString) {
    return -1;
  } else if (bIsString) {
    return 1;
  } else {
    return 0;
  }
}

export function pushUnique<T>(array: T[], entry: T) {
  const index = array.indexOf(entry);

  if (index > -1) {
    // the entry already exists in the array, but since the presedence between
    // addons is "last right wins". We first remove the duplicate entry, and
    // append it to the end of the array.
    array.splice(index, 1);
  }

  // At this point, the entry is not in the array. So we must append it.
  array.push(entry);

  // All this ensures:
  // pushUnique([a1,a2,a3], a1)
  // results in:
  //
  // [a2, a3, a1]
  //
  // which results in the most "least surprising" addon ordering.
}
