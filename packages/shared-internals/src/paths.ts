import { relative, isAbsolute, dirname, join, basename, resolve, sep, parse as pathParse } from 'path';
import type Package from './package';

// by "explicit", I mean that we want "./local/thing" instead of "local/thing"
// because
//     import "./local/thing"
// has a different meaning than
//     import "local/thing"
//
export function explicitRelative(fromDir: string, toFile: string) {
  let result = join(relative(fromDir, dirname(toFile)), basename(toFile));
  if (!isAbsolute(result) && !result.startsWith('.')) {
    result = './' + result;
  }
  if (isAbsolute(toFile) && result.split(sep).join('/').endsWith(toFile)) {
    // this prevents silly "relative" paths like
    // "../../../../../Users/you/projects/your/stuff" when we could have just
    // said "/Users/you/projects/your/stuff". The silly path isn't incorrect,
    // but it's unnecessarily verbose.
    return toFile;
  }

  // windows supports both kinds of path separators but webpack wants relative
  // paths to use forward slashes.
  return result.replace(/\\/g, '/');
}

// given a list like ['.js', '.ts'], return a regular expression for files ending
// in those extensions.
export function extensionsPattern(extensions: string[]): RegExp {
  return new RegExp(`(${extensions.map(e => `${e.replace('.', '\\.')}`).join('|')})$`, 'i');
}

export function unrelativize(pkg: Package, specifier: string, fromFile: string) {
  if (pkg.packageJSON.exports) {
    throw new Error(`unsupported: engines cannot use package.json exports`);
  }
  let result = resolve(dirname(fromFile), specifier).replace(pkg.root, pkg.name);
  if (sep !== '/') {
    result = result.split(sep).join('/');
  }
  return result;
}

const postfixRE = /[?#].*$/s;

// this is the same implementation Vite uses internally to keep its
// cache-busting query params from leaking where they shouldn't.
// includeHashSign true means #my-specifier is considered part of the pathname
export function cleanUrl(url: string): string {
  // a tiny bit of defensive programming to make sure that things won't explode
  // a simple example is executing babel with @embroider/macros on a file without
  // a filename (not on disk) will cause an error here
  if (!url) {
    return url;
  }
  const regexp = postfixRE;
  return url.replace(regexp, '');
}

// includeHashSign true means #my-specifier is considered part of the pathname
export function getUrlQueryParams(url: string): string {
  const regexp = postfixRE;
  return url.match(regexp)?.[0] ?? '';
}

// given a filename, returns it with the hbs extension
// for instance, passing filename.js returns filename.hbs
export function correspondingTemplate(filename: string): string {
  let { ext } = pathParse(filename);
  return filename.slice(0, filename.length - ext.length) + '.hbs';
}
