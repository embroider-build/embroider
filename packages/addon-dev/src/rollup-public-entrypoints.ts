import walkSync from 'walk-sync';
import path from 'path';
import minimatch from 'minimatch';

import type { Plugin } from 'rollup';

function normalizeFileExt(fileName: string) {
  return fileName.replace(/(?<!\.d)\.ts|\.hbs|\.gts|\.gjs$/, '.js');
}

export default function publicEntrypoints(args: {
  srcDir: string;
  include: string[];
  exclude?: string[];
}): Plugin {
  return {
    name: 'addon-modules',
    async buildStart() {
      let matches = walkSync(args.srcDir, {
        globs: [...args.include, '**/*.hbs', '**/*.ts', '**/*.gts', '**/*.gjs'],
        ignore: args.exclude,
      });

      for (let name of matches) {
        this.addWatchFile(path.join(args.srcDir, name));

        // the matched file, but with the extension swapped with .js
        let normalizedName = normalizeFileExt(name);

        // anything that doesn't match the users patterns, and wasn't a template-only
        // component needs to be emitted "as-is" so that other plugins may handle it.
        let isTO = isTemplateOnly(matches, name);

        let isHbs = path.extname(name) === '.hbs';

        // hbs for-colocated components is handled by the rollup-hbs-plugin
        // hbs for template-only components is handled in the isTO block
        if (isHbs && !isTO) {
          continue;
        }

        // these chunks matched are **/*.hbs glob and are
        // guaranteed to not have any corresponding file as a co-located component would have.
        if (isTO) {
          this.emitFile({
            type: 'chunk',
            id: path.join(args.srcDir, normalizedName),
            fileName: normalizedName,
          });

          continue;
        }

        // anything that matches one of the user's patterns is definitely emitted
        let isUserDefined = args.include.some((pattern) =>
          minimatch(name, pattern)
        );

        // additionally, we want to emit chunks where the pattern matches the supported
        // file extensions above (TS, GTS, etc) as if they were already the built JS.
        let wouldMatchIfBuilt = args.include.some((pattern) =>
          minimatch(normalizedName, pattern)
        );

        if (isUserDefined || wouldMatchIfBuilt) {
          this.emitFile({
            type: 'chunk',
            id: path.join(args.srcDir, name),
            fileName: normalizedName,
          });

          continue;
        }
      }
    },
  };
}

function isTemplateOnly(matches: string[], filePath: string) {
  let isHbs = path.extname(filePath) === '.hbs';

  if (!isHbs) return false;

  let correspondingFileGlob = path.join(
    path.dirname(filePath),
    path.basename(filePath).replace(/hbs$/, '*')
  );

  let relatedFiles = matches.filter((match) =>
    minimatch(match, correspondingFileGlob)
  );
  let isTO = relatedFiles.filter((x) => x !== filePath).length === 0;

  return isTO;
}
