import type { Plugin } from 'rollup';
import execa from 'execa';
import walkSync from 'walk-sync';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export default function rollupDeclarationsPlugin(
  declarationsDir: string
): Plugin {
  let glintPromise: Promise<void>;

  return {
    name: 'declarations',
    buildStart() {
      const runGlint = async () => {
        let { exitCode, escapedCommand } = await execa(
          'glint',
          ['--declaration'],
          {
            // using stdio: inherit is the only way to retain color output from the
            // underlying tsc process.
            // However, the viewer of the error will not know which plugin it comes from.
            // So that's why we have the additional logging below
            stdio: 'inherit',
            preferLocal: true,
            // Without reject, execa would throw a hard exception
            reject: false,
          }
        );

        if (exitCode > 0) {
          let msg = `Failed to generate declarations via \`${escapedCommand}\``;

          if (this.meta.watchMode) {
            this.warn(msg);
          } else {
            this.error(msg);
          }
        }

        await fixDeclarationsInMatchingFiles(declarationsDir);
        if (exitCode === 0) {
          this.info(`\`${escapedCommand}\` succeeded`);
        }
      };

      // We just kick off glint here early in the rollup process, without making rollup wait for this to finish, by not returning the promise
      // The output of this is not relevant to further stages of the rollup build, this is just happening in parallel to other rollup compilation
      glintPromise = runGlint();
    },

    // Make rollup wait for glint to have finished before calling the build job done
    writeBundle: () => glintPromise,
  };
}

async function fixDeclarationsInMatchingFiles(dir: string) {
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

  return Promise.all(
    dtsFiles.map(async (file) => {
      const content = await readFile(file, { encoding: 'utf8' });

      await writeFile(file, fixDeclarations(content));
    })
  );
}

// Strip any .gts extension from imports in d.ts files, as these won't resolve. See https://github.com/typed-ember/glint/issues/628
// Once Glint v2 is available, this shouldn't be needed anymore.
function fixDeclarations(content: string) {
  return content
    .replace(/from\s+'([^']+)\.gts'/g, `from '$1'`)
    .replace(/from\s+"([^"]+)\.gts"/g, `from '$1'`)
    .replace(/import\("([^"]+)\.gts"\)/g, `import('$1')`)
    .replace(/import\('([^']+)\.gts'\)/g, `import('$1')`);
}
