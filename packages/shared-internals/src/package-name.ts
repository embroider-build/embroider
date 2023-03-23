import { isAbsolute } from 'path';

export default function absolutePackageName(specifier: string): string | undefined {
  if (
    // relative paths:
    specifier[0] === '.' ||
    // webpack-specific microsyntax for internal requests:
    specifier[0] === '!' ||
    specifier[0] === '-' ||
    // absolute paths:
    isAbsolute(specifier)
  ) {
    // Does not refer to a package
    return;
  }
  let parts = specifier.split('/');
  if (specifier[0] === '@') {
    return `${parts[0]}/${parts[1]}`;
  } else {
    return parts[0];
  }
}
