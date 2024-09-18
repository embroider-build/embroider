import { existsSync } from 'fs-extra';
import { cleanUrl } from './paths';
import type PackageCache from './package-cache';
import { sep } from 'path';
import { resolve as resolveExports } from 'resolve.exports';

export function syntheticJStoHBS(source: string): string | null {
  // explicit js is the only case we care about here. Synthetic template JS is
  // only ever JS (never TS or anything else). And extensionless imports are
  // handled by the default resolving system doing extension search.
  if (cleanUrl(source).endsWith('.js')) {
    return source.replace(/.js(\?.*)?/, '.hbs$1');
  }

  return null;
}

export function needsSyntheticComponentJS(requestedSpecifier: string, foundFile: string): string | null {
  requestedSpecifier = cleanUrl(requestedSpecifier);
  foundFile = cleanUrl(foundFile);
  if (
    discoveredImplicitHBS(requestedSpecifier, foundFile) &&
    !foundFile.split(sep).join('/').endsWith('/template.hbs') &&
    !correspondingJSExists(foundFile)
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

export function isInComponents(url: string, packageCache: Pick<PackageCache, 'ownerOfFile'>) {
  const id = cleanUrl(url);

  const pkg = packageCache.ownerOfFile(id);
  if (!pkg?.isV2App()) {
    return false;
  }

  let tryResolve = resolveExports(pkg.packageJSON, './components', {
    browser: true,
    conditions: ['default', 'imports'],
  });
  let componentsDir = tryResolve?.[0] ?? './components';
  return ('.' + id.slice(pkg?.root.length).split(sep).join('/')).startsWith(componentsDir);
}

export function templateOnlyComponentSource() {
  return `import templateOnly from '@ember/component/template-only';\nexport default templateOnly();\n`;
}
