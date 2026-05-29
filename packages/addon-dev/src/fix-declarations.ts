import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import walkSync from 'walk-sync';

// Strip any .gts extension from imports in d.ts files, as these won't resolve. See https://github.com/typed-ember/glint/issues/628
// Once Glint v2 is available, this shouldn't be needed anymore.
export function fixDeclarations(content: string): string {
  return content
    .replace(/from\s+'([^']+)\.gts'/g, `from '$1'`)
    .replace(/from\s+"([^"]+)\.gts"/g, `from '$1'`)
    .replace(/import\("([^"]+)\.gts"\)/g, `import('$1')`)
    .replace(/import\('([^']+)\.gts'\)/g, `import('$1')`);
}

export async function fixDeclarationsInMatchingFiles(
  dir: string
): Promise<void> {
  // can't fix what doesn't exist
  // (happens when glint errors and doesn't output a ${dir} directory
  if (!existsSync(dir)) {
    return;
  }

  const dtsFiles = walkSync(dir, {
    globs: ['**/*.d.ts'],
    directories: false,
    includeBasePath: true,
  });

  await Promise.all(
    dtsFiles.map(async (file) => {
      const content = await readFile(file, { encoding: 'utf8' });

      await writeFile(file, fixDeclarations(content));
    })
  );
}
