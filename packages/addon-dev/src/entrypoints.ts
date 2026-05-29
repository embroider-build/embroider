import walkSync from 'walk-sync';
import path from 'path';
import minimatch from 'minimatch';

export function normalizeFileExt(fileName: string): string {
  return fileName.replace(/(?<!\.d)\.ts|\.hbs|\.gts|\.gjs$/, '.js');
}

export interface Entrypoint {
  // path relative to srcDir of the source file
  name: string;
  // path relative to srcDir used as the module id. For template-only `.hbs`
  // components this is the normalized `.js` name (so the hbs plugin's synthetic
  // resolution applies); for everything else it is the original source name.
  idName: string;
  // path relative to srcDir of the source file, with the extension swapped to .js
  fileName: string;
}

// Given the user's public-entrypoint globs, walk srcDir and determine which
// source modules become public entrypoints. Shared by the rollup
// `publicEntrypoints` plugin and the tsdown config builder so both select the
// exact same set of files.
export function discoverEntrypoints(args: {
  srcDir: string;
  include: string[];
  exclude?: string[];
}): Entrypoint[] {
  const include = [
    ...args.include,
    '**/*.hbs',
    '**/*.ts',
    '**/*.gts',
    '**/*.gjs',
  ];

  const matches = walkSync(args.srcDir, {
    globs: include,
    ignore: args.exclude,
  });

  const entrypoints: Entrypoint[] = [];

  for (let name of matches) {
    let normalizedName = normalizeFileExt(name);
    let isTO = isTemplateOnly(matches, name);
    let isHbs = path.extname(name) === '.hbs';

    // hbs for co-located components is handled by the rollup-hbs-plugin
    // hbs for template-only components is handled in the isTO block
    if (isHbs && !isTO) {
      continue;
    }

    // template-only hbs files are guaranteed to not have any corresponding
    // file as a co-located component would have.
    if (isTO) {
      entrypoints.push({
        name,
        idName: normalizedName,
        fileName: normalizedName,
      });
      continue;
    }

    let isUserDefined = args.include.some((pattern) =>
      minimatch(name, pattern)
    );

    // additionally, we want to emit chunks where the pattern matches the
    // supported file extensions above (TS, GTS, etc) as if they were already
    // the built JS.
    let wouldMatchIfBuilt = include.some((pattern) =>
      minimatch(normalizedName, pattern)
    );

    if (isUserDefined || wouldMatchIfBuilt) {
      entrypoints.push({ name, idName: name, fileName: normalizedName });
    }
  }

  return entrypoints;
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
