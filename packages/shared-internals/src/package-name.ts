import { isAbsolute } from 'path';

export default function absolutePackageName(specifier: string): string | undefined {
  if (specifier[0] === '.' || isAbsolute(specifier)) {
    // Not an absolute specifier
    return;
  }
  let parts = specifier.split('/');
  if (specifier[0] === '@') {
    return `${parts[0]}/${parts[1]}`;
  } else {
    return parts[0];
  }
}
