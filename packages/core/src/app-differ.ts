import { AddonPackage } from '@embroider/shared-internals';
import MultiTreeDiff, { InputTree } from './multi-tree-diff';
import walkSync from 'walk-sync';
import { join, basename, dirname, resolve } from 'path';
import { mkdirpSync, unlinkSync, rmdirSync, removeSync, copySync, writeFileSync, readFileSync } from 'fs-extra';
import { debug } from './messages';
import assertNever from 'assert-never';
import { describeExports } from './describe-exports';
import { compile } from './js-handlebars';
import { TransformOptions } from '@babel/core';
import { statSync } from 'fs';
import { format } from 'util';

export default class AppDiffer {
  private differ: MultiTreeDiff;
  private sources: Source[];
  private firstFastbootTree = Infinity;

  // maps from each filename in the app to the original directory from whence it
  // came, if it came from an addon. The mapping allows us to preserve
  // resolution semantics so that each of the app files can still resolve
  // relative to where it was authored.
  //
  // files authored within the app map to null
  readonly files: Map<string, string | null> = new Map();

  // true for files that are fastboot-only.
  isFastbootOnly: Map<string, boolean> = new Map();

  constructor(
    private outputPath: string,
    ownAppJSDir: string,
    activeAddonDescendants: AddonPackage[],
    // arguments below this point are only needed in fastboot mode. Fastboot
    // makes this pretty messy because fastboot trees all merge into the app 🤮.
    fastbootEnabled = false,
    ownFastbootJSDir?: string | undefined,
    private babelParserConfig?: TransformOptions | undefined
  ) {
    this.sources = activeAddonDescendants.map(addon => maybeSource(addon, 'app-js')).filter(Boolean) as Source[];

    this.sources.push({
      mayChange: true,
      walk() {
        return walkSync.entries(ownAppJSDir);
      },
      isRelocated: false,
      locate(relativePath: string) {
        return resolve(ownAppJSDir, relativePath);
      },
    });

    if (!fastbootEnabled) {
      this.differ = new MultiTreeDiff(this.sources, lastOneWins);
      return;
    }

    this.firstFastbootTree = this.sources.length;
    for (let addon of activeAddonDescendants) {
      let source = maybeSource(addon, 'fastboot-js');
      if (source) {
        this.sources.push(source);
      }
    }
    if (ownFastbootJSDir) {
      this.sources.push({
        mayChange: true,
        walk() {
          return walkSync.entries(ownFastbootJSDir);
        },
        isRelocated: false,
        locate(relativePath) {
          return resolve(ownFastbootJSDir, relativePath);
        },
      });
    }
    this.differ = new MultiTreeDiff(this.sources, fastbootMerge(this.firstFastbootTree));
  }

  update() {
    let { ops, sources } = this.differ.update();
    debug(`app-differ operations count: %s`, ops.length);
    for (let [operation, relativePath] of ops) {
      let outputPath = join(this.outputPath, relativePath);
      switch (operation) {
        case 'unlink':
          unlinkSync(outputPath);
          this.files.delete(relativePath);
          break;
        case 'rmdir':
          rmdirSync(outputPath);
          break;
        case 'mkdir':
          mkdirpSync(outputPath);
          break;
        case 'change':
          removeSync(outputPath);
        // deliberate fallthrough
        case 'create':
          let sourceIndices = sources.get(relativePath)!;
          if (sourceIndices.length === 1) {
            // a single file won. whether it's fastboot or non-fastboot doesn't
            // actually change what we do here. It gets emitted in the app's
            // namespace (if it's fastboot-only, non-fastboot code shouldn't be
            // trying to import it anyway, because that would have already been
            // an error pre-embroider).
            this.isFastbootOnly.set(relativePath, sourceIndices[0] >= this.firstFastbootTree);
            let source = this.sources[sourceIndices[0]];
            let sourceFile = source.locate(relativePath);
            copySync(sourceFile, outputPath, { dereference: true });
            this.updateFiles(relativePath, source, sourceFile);
          } else {
            // we have both fastboot and non-fastboot files for this path.
            // Because of the way fastbootMerge is written, the first one is the
            // non-fastboot.
            this.isFastbootOnly.set(relativePath, false);
            let [browserSrc, fastbootSrc] = sourceIndices.map(i => this.sources[i]);
            let [browserSourceFile, fastbootSourceFile] = [browserSrc, fastbootSrc].map(src =>
              src.locate(relativePath)
            );
            let dir = dirname(relativePath);
            let base = basename(relativePath);
            let browserDest = `_browser_${base}`;
            let fastbootDest = `_fastboot_${base}`;
            copySync(browserSourceFile, join(this.outputPath, dir, browserDest), { dereference: true });
            copySync(fastbootSourceFile, join(this.outputPath, dir, fastbootDest), { dereference: true });
            writeFileSync(
              outputPath,
              switcher(browserDest, fastbootDest, this.babelParserConfig!, readFileSync(browserSourceFile, 'utf8'))
            );
            this.updateFiles(relativePath, browserSrc, browserSourceFile);
          }
          break;
        default:
          assertNever(operation);
      }
    }
  }

  private updateFiles(relativePath: string, source: Source, sourceFile: string) {
    if (source.isRelocated) {
      this.files.set(relativePath, sourceFile);
    } else {
      this.files.set(relativePath, null);
    }
  }
}

function lastOneWins(treeIds: number[]) {
  return treeIds.slice(-1);
}

function fastbootMerge(firstFastbootTree: number) {
  return function _fastbootMerge(treeIds: number[]): number[] {
    let mainWinner, fastbootWinner;
    for (let id of treeIds) {
      if (id < firstFastbootTree) {
        mainWinner = id;
      } else {
        fastbootWinner = id;
      }
    }
    if (mainWinner != null && fastbootWinner != null) {
      return [mainWinner, fastbootWinner];
    } else if (mainWinner != null) {
      return [mainWinner];
    } else if (fastbootWinner != null) {
      return [fastbootWinner];
    } else {
      throw new Error(`bug: should always have at least one winner in fastbootMerge`);
    }
  };
}

const switcherTemplate = compile(`
import { macroCondition, getGlobalConfig, importSync } from '@embroider/macros';
let mod;
if (macroCondition(getGlobalConfig().fastboot?.isRunning)){
  mod = importSync("./{{js-string-escape fastbootDest}}");
} else {
  mod = importSync("./{{js-string-escape browserDest}}");
}
{{#if hasDefaultExport}}
export default mod.default;
{{/if}}
{{#each names as |name|}}
export const {{name}} = mod.{{name}};
{{/each}}
`) as (params: { fastbootDest: string; browserDest: string; names: string[]; hasDefaultExport: boolean }) => string;

function switcher(
  browserDest: string,
  fastbootDest: string,
  babelParserConfig: TransformOptions,
  browserSource: string
): string {
  let { names, hasDefaultExport } = describeExports(browserSource, babelParserConfig);
  return switcherTemplate({ fastbootDest, browserDest, names: [...names], hasDefaultExport });
}

interface Source extends InputTree {
  // find the real on disk location of the file that is presented externally as
  // `relativePath`
  locate(relativePath: string): string;

  // true if this source relocates its file out of their original package,
  // meaning we will need to track them in order to adjust package resolution
  isRelocated: boolean;
}

function maybeSource(addon: AddonPackage, key: 'app-js' | 'fastboot-js'): Source | undefined {
  let maybeFiles = addon.meta[key];
  if (maybeFiles) {
    let files = maybeFiles;
    return {
      mayChange: addon.mayRebuild,
      walk() {
        return Object.entries(files).map(([externalName, internalName]) => {
          try {
            let stat = statSync(resolve(addon.root, internalName));
            return {
              relativePath: withoutMandatoryDotSlash(externalName, [
                'in package.json at %s in key ember-addon.%s',
                addon.root,
                key,
              ]),
              mode: stat.mode,
              size: stat.size,
              mtime: stat.mtime,
              isDirectory() {
                return false;
              },
            };
          } catch (err) {
            if (err.code === 'ENOENT') {
              throw new Error(
                `${addon.name}/package.json lists ${internalName} in ember-addon.${key}, but that file does not exist`
              );
            }
            throw err;
          }
        });
      },
      isRelocated: true,
      locate(relativePath: string) {
        let internal = files['./' + relativePath];
        if (!internal) {
          throw new Error(`bug: couldn't find ${relativePath} in ${JSON.stringify(files)}`);
        }
        return resolve(addon.root, internal);
      },
    };
  }
}

function withoutMandatoryDotSlash(filename: string, debugInfo: any[]): string {
  if (!filename.startsWith('./')) {
    throw new Error(`${format(debugInfo)}: ${filename} is required to start with "./"`);
  }
  return filename.slice(2);
}
