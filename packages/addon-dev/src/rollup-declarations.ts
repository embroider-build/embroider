import type { Plugin } from 'rollup';
import execa from 'execa';
import walkSync from 'walk-sync';
import { readFile, rename, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { packageUp } from 'package-up';

let glint1 = 'glint --declaration';
let glint2 = 'ember-tsc --declaration';

export default function rollupDeclarationsPlugin(
  declarationsDir: string,
  /**
   * The command to use to generate types.
   * Defaults to:
   * - glint --declaration     # for glint v1
   * - ember-tsc --declaration # for glint v2
   */
  command?: string
): Plugin {
  let glintPromise: Promise<void>;

  let commandToRun = command;

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
    globs: ['**/*.d.ts', '**/*.d.gts.ts', '**/*.d.gjs.ts'],
    directories: false,
    includeBasePath: true,
  });

  return Promise.all(
    dtsFiles.map(async (file) => {
      // TypeScript has never supported "compiled to JS" workflows
      // when using external tools.
      //
      // So, the "arbitrary extensions" TS emits, will look like .d.gts.ts
      //   or .d.gjs.ts
      //
      // Because TS doesn't understand that external tools emit JS,
      //   and thus their declarations must be .d.ts, we have to
      //   manually handle this rename ourselves.
      //
      // Upstream: https://github.com/microsoft/TypeScript/issues/64053
      // This'll be a no-op if/when TS fixes this.
      let target = file.replace(/\.d\.(gts|gjs)\.ts$/, '.d.ts');

      if (target !== file) {
        await rename(file, target);
      }

      const content = await readFile(target, { encoding: 'utf8' });

      await writeFile(target, fixDeclarations(content));
    })
  );
}

// Strip any .gts/.gjs extension from imports in d.ts files, as these won't
// resolve once the declaration files themselves are named *.d.ts.
// See
//  - https://github.com/typed-ember/glint/issues/628
//  - https://github.com/microsoft/TypeScript/issues/64053
function fixDeclarations(content: string) {
  return content
    .replace(/from\s+'([^']+)\.(gts|gjs)'/g, `from '$1'`)
    .replace(/from\s+"([^"]+)\.(gts|gjs)"/g, `from '$1'`)
    .replace(/import\("([^"]+)\.(gts|gjs)"\)/g, `import('$1')`)
    .replace(/import\('([^']+)\.(gts|gjs)'\)/g, `import('$1')`);
}
