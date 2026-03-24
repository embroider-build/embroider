import { posix } from 'path';
import { exports as resolveExports } from 'resolve.exports';

type Exports = string | string[] | { [key: string]: Exports };

/**
 * An util to find a string value in a nested JSON-like structure.
 *
 * Receives an object (a netsted JSON-like structure) and a matcher callback
 * that is tested against each string value.
 *
 * When a value is found, returns an object containing a `value` and a `key`.
 * The key is one of the parent keys of the found value — the one that starts
 * with `.`.
 *
 * When a value is not found, returns `undefined`.
 */
export function _findPathRecursively(
  exportsObj: Exports,
  matcher: (path: string) => boolean,
  key = '.'
): { key: string; value: Exports } | undefined {
  if (typeof exportsObj === 'string') {
    return matcher(exportsObj) ? { key, value: exportsObj } : undefined;
  }

  if (Array.isArray(exportsObj)) {
    const value = exportsObj.find(path => matcher(path));

    if (value) {
      return { key, value };
    } else {
      return undefined;
    }
  }

  if (typeof exportsObj === 'object') {
    let result: { key: string; value: Exports } | undefined = undefined;

    for (const candidateKey in exportsObj) {
      if (!exportsObj.hasOwnProperty(candidateKey)) {
        return;
      }

      const candidate = _findPathRecursively(exportsObj[candidateKey], matcher, key);

      if (candidate) {
        result = {
          key: candidateKey,
          value: candidate.value,
        };

        break;
      }
    }

    if (result) {
      if (result.key.startsWith('./')) {
        if (key !== '.') {
          throw new Error(`exportsObj contains doubly nested path keys: "${key}" and "${result.key}"`);
        }

        return { key: result.key, value: result.value };
      } else {
        return { key, value: result.value };
      }
    } else {
      return undefined;
    }
  }

  throw new Error(`Unexpected type of obj: ${typeof exportsObj}`);
}

export default function reversePackageExports(
  { exports: exportsObj, name }: { exports?: Exports; name: string },
  relativePath: string
): string {
  if (!exportsObj) {
    return posix.join(name, relativePath);
  }

  const maybeKeyValuePair = _findPathRecursively(exportsObj, candidate => {
    const regex = new RegExp(_prepareStringForRegex(candidate));

    return regex.test(relativePath);
  });

  if (!maybeKeyValuePair) {
    throw new Error(
      `You tried to reverse exports for the file \`${relativePath}\` in package \`${name}\` but it does not match any of the exports rules defined in package.json. This means it should not be possible to access directly.`
    );
  }

  const { key, value } = maybeKeyValuePair;

  if (typeof value !== 'string') {
    throw new Error('Expected value to be a string');
  }

  const maybeResolvedPaths = resolveExports({ name, exports: { [value]: key } }, relativePath);

  if (!maybeResolvedPaths) {
    throw new Error(
      `Bug Discovered! \`_findPathRecursively()\` must always return a string value but instead it found a ${typeof value}. Please report this as an issue to https://github.com/embroider-build/embroider/issues/new`
    );
  }

  const [resolvedPath] = maybeResolvedPaths;

  return resolvedPath.replace(/^./, name);
}

export function _prepareStringForRegex(input: string): string {
  let result = input
    .split('*')
    .map(substr => substr.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('.*');

  if (result.endsWith('/')) {
    result += '.*';
  }

  return `^${result}$`;
}
