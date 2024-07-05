import { existsSync } from 'fs-extra';
import { cleanUrl } from './paths';
import type PackageCache from './package-cache';

export function needsSyntheticComponentJS(
  requestedSpecifier: string,
  foundFile: string,
  packageCache: Pick<PackageCache, 'ownerOfFile'>
): string | null {
  requestedSpecifier = cleanUrl(requestedSpecifier, true);
  foundFile = cleanUrl(foundFile);
  if (
    discoveredImplicitHBS(requestedSpecifier, foundFile) &&
    !foundFile.endsWith('/template.hbs') &&
    !correspondingJSExists(foundFile) &&
    isInComponents(foundFile, packageCache)
  ) {
    return foundFile.slice(0, -3) + 'js';
  }
  return null;
}

function discoveredImplicitHBS(source: string, id: string): boolean {
  return source.endsWith('.hbs') && id.endsWith('.hbs');
}

function correspondingJSExists(id: string): boolean {
  return ['js', 'ts'].some(ext => existsSync(id.slice(0, -3) + ext));
}

function isInComponents(id: string, packageCache: Pick<PackageCache, 'ownerOfFile'>) {
  const pkg = packageCache.ownerOfFile(id);
  return pkg?.isV2App() && id.slice(pkg?.root.length).startsWith('/components');
}

export function templateOnlyComponentSource() {
  return `import templateOnly from '@ember/component/template-only';\nexport default templateOnly();\n`;
}
