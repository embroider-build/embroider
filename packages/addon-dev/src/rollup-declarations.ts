import type { Plugin } from 'rollup';
import execa from 'execa';
import walkSync from 'walk-sync';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { packageUp } from 'package-up';

let glint1 = 'glint --declaration';
let glint2 = 'ember-tsc --declaration';

export type DeclarationsOptions = {
  /**
   * The command to use to generate types.
   * Defaults to:
   * - glint --declaration     # for glint v1
   * - ember-tsc --declaration # for glint v2
   */
  command?: string;

  /**
   * How often to run the command while rollup is in watch mode. Outside of
   * watch mode it always runs.
   *
   * - 'once' (default): run on the first build, then leave the emitted
   *   declarations in place for the rest of the watch session. A consuming
   *   app's editor and type-checker need the files to exist on disk; they
   *   don't need them regenerated on every keystroke, and the addon author
   *   already sees type errors in their editor.
   *   A failed run is retried on the next rebuild, so fixing the error that
   *   broke the first attempt still gets you declarations.
   * - 'always': type-check and re-emit on every rebuild. Always correct but
   *   slow; on a few hundred source files this adds seconds to every rebuild.
   * - 'never': don't emit declarations in watch mode at all. For addons that
   *   run their own `tsc --watch` alongside rollup.
   */
  watch?: 'once' | 'always' | 'never';
};

export default function rollupDeclarationsPlugin(
  declarationsDir: string,
  commandOrOptions?: string | DeclarationsOptions
): Plugin {
  let options: DeclarationsOptions =
    typeof commandOrOptions === 'string'
      ? { command: commandOrOptions }
      : commandOrOptions ?? {};

  let watchBehavior = options.watch ?? 'once';

  let glintPromise: Promise<void> | undefined;

  let commandToRun = options.command;

  // set once a watch-mode run has been kicked off, and cleared again if that
  // run fails so the next rebuild retries it
  let ranInWatchMode = false;

  function shouldRunInWatchMode() {
    switch (watchBehavior) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'once':
        return !ranInWatchMode;
    }
  }

  async function determineCommand() {
    if (commandToRun) return;

    let manifestPath = await packageUp();
    if (!manifestPath) {
      /**
       * Historical default is to use glint v1
       */
      commandToRun = glint1;
      return;
    }

    let manifestBuffer = readFileSync(manifestPath);
    let manifest = JSON.parse(manifestBuffer.toString());
    let deps = {
      ...manifest.devDependencies,
      ...manifest.dependencies,
    };

    if (deps['@glint/ember-tsc']) {
      commandToRun = glint2;
      return;
    }
    if (deps['@glint/core']) {
      commandToRun = glint1;
      return;
    }

    throw new Error(
      `Cannot use addon.declarations() plugin without glint present or an explicit command set as the second parameter. e.g.: addon.declarations('declarations', 'tsc --declaration')`
    );
  }

  return {
    name: 'declarations',
    buildStart() {
      if (this.meta.watchMode && !shouldRunInWatchMode()) {
        glintPromise = undefined;
        return;
      }

      // Claim the 'once' slot up front so that rebuilds queued while this run
      // is still in flight don't spawn a second type-check. Released again
      // below if the run fails.
      ranInWatchMode = true;

      const runGlint = async () => {
        await determineCommand();

        if (!commandToRun) return;

        let { exitCode, escapedCommand } = await execa.command(commandToRun, {
          // using stdio: inherit is the only way to retain color output from the
          // underlying tsc process.
          // However, the viewer of the error will not know which plugin it comes from.
          // So that's why we have the additional logging below
          stdio: 'inherit',
          preferLocal: true,
          // Without reject, execa would throw a hard exception
          reject: false,
        });

        if (exitCode > 0) {
          ranInWatchMode = false;
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
