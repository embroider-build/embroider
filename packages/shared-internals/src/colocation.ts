import { existsSync } from 'fs-extra';
import { cleanUrl } from './paths';
import type PackageCache from './package-cache';
import { sep } from 'path';

export function syntheticJStoHBS(source: string): string | null {
  // explicit js is the only case we care about here. Synthetic template JS is
  // only ever JS (never TS or anything else). And extensionless imports are
  // handled by the default resolving system doing extension search.
  if (cleanUrl(source).endsWith('.js')) {
    return source.replace(/.js(\?.*)?/, '.hbs$1');
  }

  return null;
}

export function needsSyntheticComponentJS(
  requestedSpecifier: string,
  foundFile: string,
  packageCache: Pick<PackageCache, 'ownerOfFile'>
): string | null {
  requestedSpecifier = cleanUrl(requestedSpecifier);
  foundFile = cleanUrl(foundFile);
  if (
    discoveredImplicitHBS(requestedSpecifier, foundFile) &&
    !foundFile.split(sep).join('/').endsWith('/template.hbs') &&
    !correspondingJSExists(foundFile) &&
    isInComponents(foundFile, packageCache)
  ) {
    return foundFile.slice(0, -3) + 'js';
  }
  return null;
}

function discoveredImplicitHBS(source: string, id: string): boolean {
  return !source.endsWith('.hbs') && id.endsWith('.hbs');
}

function correspondingJSExists(id: string): boolean {
  return ['js', 'ts'].some(ext => existsSync(id.slice(0, -3) + ext));
}

function isInComponents(id: string, packageCache: Pick<PackageCache, 'ownerOfFile'>) {
  const pkg = packageCache.ownerOfFile(id);
  return pkg?.isV2App() && id.slice(pkg?.root.length).split(sep).join('/').startsWith('/components');
}

export function templateOnlyComponentSource() {
  return `import templateOnly from '@ember/component/template-only';\nexport default templateOnly();\n`;
}
