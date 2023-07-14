import { dirname, join, resolve } from 'path';

export const root = resolve(__dirname, '../../../');

export function relativeToAbsolute(repoRelative: string) {
  return join(root, repoRelative);
}

export function absoluteDirname(repoRelative: string) {
  return dirname(relativeToAbsolute(repoRelative));
}
