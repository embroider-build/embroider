import { posix } from 'path';

export default function reversePackageExports(
  packageJSON: { exports?: any; name: string },
  relativePath: string
): string {
  // TODO add an actual matching system and don't just look for the default
  if (packageJSON.exports?.['./*'] === './dist/*.js') {
    return posix.join(packageJSON.name, relativePath.replace(/^.\/dist\//, `./`).replace(/\.js$/, ''));
  }

  // TODO figure out what the result should be if it doesn't match anything in exports
  return posix.join(packageJSON.name, relativePath);
}
