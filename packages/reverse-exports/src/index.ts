import { posix } from 'path';
import { exports as resolveExports } from 'resolve.exports';

type PkgJSON = { name: string; exports?: Exports };
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

/*
  Takes a relativePath that is relative to the package root and produces its
  externally-addressable name.

  Returns undefined for a relativePath that is forbidden to be accessed from the
  outside.
*/
export function externalName(pkg: PkgJSON, relativePath: string): string | undefined {
  let { exports } = pkg;
  if (!exports) {
    return posix.join(pkg.name, relativePath);
  }

  const maybeKeyValuePair = _findPathRecursively(exports, candidate => _stringToRegex(candidate).test(relativePath));

  if (!maybeKeyValuePair) {
    return undefined;
  }

  const { key, value } = maybeKeyValuePair;

  if (typeof value !== 'string') {
    throw new Error('Expected value to be a string');
  }

  const maybeResolvedPaths = resolveExports({ name: pkg.name, exports: { [value]: key } }, relativePath);

  if (!maybeResolvedPaths) {
    throw new Error(
      `Bug Discovered! \`_findPathRecursively()\` must always return a string value but instead it found a ${typeof value}. Please report this as an issue to https://github.com/embroider-build/embroider/issues/new`
    );
  }

  const [resolvedPath] = maybeResolvedPaths;

  return posix.join(pkg.name, resolvedPath);
}

function regexEscape(input: string): string {
  return input.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function _stringToRegex(input: string): RegExp {
  let wildCardIndex = input.indexOf('*');

  if (~wildCardIndex) {
    return new RegExp(
      `^${regexEscape(input.substring(0, wildCardIndex))}.*${regexEscape(input.substring(wildCardIndex + 1))}$`
    );
  } else {
    return new RegExp(`^${regexEscape(input)}$`);
  }
}
