import { dirname, isAbsolute, resolve as pathResolve } from 'path';
import { explicitRelative } from '@embroider/shared-internals';

export function resolve(
  specifier: string,
  fromFile: string
): { type: 'found'; result: { type: 'real'; filename: string } } | { type: 'not_found'; err: Error } {
  // require.resolve does not like when we resolve from virtual paths.
  // That is, a request like "../thing.js" from
  // "/a/real/path/VIRTUAL_SUBDIR/virtual.js" has an unambiguous target of
  // "/a/real/path/thing.js", but require.resolve won't do that path
  // adjustment until after checking whether VIRTUAL_SUBDIR actually
  // exists.
  //
  // We can do the path adjustments before doing require.resolve.
  let fromDir = dirname(fromFile);
  if (!isAbsolute(specifier) && specifier.startsWith('.')) {
    let targetPath = pathResolve(fromDir, specifier);
    let newFromDir = dirname(targetPath);
    if (fromDir !== newFromDir) {
      specifier = explicitRelative(newFromDir, targetPath);
      fromDir = newFromDir;
    }
  }

  let initialError;

  for (let candidate of candidates(specifier, defaultExtensions)) {
    let filename;
    try {
      filename = require.resolve(candidate, {
        paths: [fromDir],
      });
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }

      if (!initialError) {
        initialError = err;
      }

      continue;
    }
    if (filename.endsWith('.hbs') && !candidate.endsWith('.hbs')) {
      // Evaluating the `handlebars` NPM package installs a Node extension
      // that puts `*.hbs` in the automatic search path. But we can't control
      // its priority, and it's really important to us that `.hbs` cannot
      // shadow other extensions with higher priority. For example, when both
      // `.ts` and `.hbs` exist, resolving is supposed to find the `.ts`.
      //
      // This covers the case where we found an hbs "by accident", when we
      // weren't actually expecting it.
      continue;
    }
    return { type: 'found', result: { type: 'real' as 'real', filename } };
  }

  return { type: 'not_found', err: initialError };
}

function* candidates(specifier: string, extensions: string[]) {
  yield specifier;

  for (let ext of extensions) {
    yield `${specifier}${ext}`;
  }
}

const defaultExtensions = ['.hbs.js', '.hbs'];
