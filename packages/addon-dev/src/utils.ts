/**
 * Not "deep equality", but "not quite shallow, value-based equality"
 * and somewhat narrowly scoped to what we care about in the "app-js"
 * structure (which is 'just JSON') (and other objects within the 'ember-addon'
 * data that the addon-dev family of plugins manage)
 *
 * The algo here is:
 * - short-circuit as early as possible to do as little work as possible
 * - check properties of objects before checking contents,
 *   because checking contents is more expensive
 * - relies on the fact that we can treat arrays and objects the same due to
 *   how JavaScript works
 */
export function hasChanges(
  a: undefined | unknown,
  b: undefined | unknown
): boolean {
  if (a === b) return false;
  if (typeof a !== typeof b) return true;

  // From this point on, a and b have the same type
  // and are truthy values
  switch (typeof a) {
    case 'string':
      return a !== b;
    case 'number':
      return a !== b;
    case 'object':
      // TS does not narrow here,
      //   given b *is* known at this point,
      //   due to `typeof a !== typeof b` has an early return.
      //
      //   TS does not not maintain the relationship of typeof a === typeof b
      if (typeof b !== 'object') return true;

      return doesObjectHaveChanges(a, b);
    default:
      // for undefined, function, symbol, bigint (none of these are valid JSON values)
      //    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
      return true;
  }
}

// Type `object` differs from `typeof` object
function doesObjectHaveChanges(a: object | null, b: object | null): boolean {
  // Need to ensure the values are turthy so that we can use Object.entries
  // This is because 'null' is an object
  if (!a || !b) return true;

  // Both Arrays and Objects behave the same when passed to Object.entries
  let aEntries = Object.entries(a);
  let bEntries = Object.entries(b);

  // Differnt sets of entries means there are changes
  if (aEntries.length !== bEntries.length) return true;

  // With aEntries and bEntries being the same length, we want to check if
  // each entry within each matches the entry within the other.
  // To do this efficiently, we need to use a "more traditional" for loop.
  for (let i = 0; i < aEntries.length; i++) {
    let aEntry = aEntries[i];
    let bEntry = bEntries[i];

    // The key
    if (aEntry[0] !== bEntry[0]) return true;

    // The value
    if (hasChanges(aEntry[1], bEntry[1])) return true;
  }

  return false;
}
