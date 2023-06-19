import { AddonPackage } from '@embroider/shared-internals';
import MultiTreeDiff, { InputTree } from './multi-tree-diff';
import walkSync from 'walk-sync';
import { join, resolve } from 'path';
import { mkdirpSync, unlinkSync, rmdirSync, removeSync } from 'fs-extra';
import { debug } from './messages';
import assertNever from 'assert-never';
import { statSync } from 'fs';
import { format } from 'util';

export default class AppDiffer {
  private differ: MultiTreeDiff;
  private sources: Source[];
  private firstFastbootTree = Infinity;

  // set of filenames logically located in the app
  readonly files: Set<string> = new Set();

  // true for files that are fastboot-only.
  isFastbootOnly: Map<string, boolean> = new Map();

  constructor(
    private outputPath: string,
    ownAppJSDir: string,
    activeAddonDescendants: AddonPackage[],
    // arguments below this point are only needed in fastboot mode. Fastboot
    // makes this pretty messy because fastboot trees all merge into the app 🤮.
    fastbootEnabled = false,
    ownFastbootJSDir?: string | undefined
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
            this.updateFiles(relativePath);
          } else {
            // we have both fastboot and non-fastboot files for this path.
            // Because of the way fastbootMerge is written, the first one is the
            // non-fastboot.
            this.isFastbootOnly.set(relativePath, false);
            this.updateFiles(relativePath);
          }
          break;
        default:
          assertNever(operation);
      }
    }
  }

  private updateFiles(relativePath: string) {
    this.files.add(relativePath);
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
