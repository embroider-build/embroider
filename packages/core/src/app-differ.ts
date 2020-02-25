import { V2AddonPackage } from './package';
import MultiTreeDiff, { InputTree } from './multi-tree-diff';
import walkSync from 'walk-sync';
import { join } from 'path';
import { mkdirpSync, unlinkSync, rmdirSync, removeSync, copySync, readFileSync } from 'fs-extra';
import { debug } from './messages';
import assertNever from 'assert-never';

export default class AppDiffer {
  private differ: MultiTreeDiff;
  private sourceDirs: string[] = [];
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
    private ownAppJSDir: string,
    activeAddonDescendants: V2AddonPackage[],
    fastbootEnabled = false,
    private ownFastbootJSDir?: string | undefined
  ) {
    let trees = activeAddonDescendants
      .map(
        (addon): InputTree | undefined => {
          let dir = addon.meta['app-js'];
          if (dir) {
            let definitelyDir = join(addon.root, dir);
            this.sourceDirs.push(definitelyDir);
            return {
              mayChange: addon.mayRebuild,
              walk() {
                return walkSync.entries(definitelyDir);
              },
            };
          }
        }
      )
      .filter(Boolean) as InputTree[];

    trees.push({
      mayChange: true,
      walk() {
        return walkSync.entries(ownAppJSDir);
      },
    });
    this.sourceDirs.push(ownAppJSDir);

    if (!fastbootEnabled) {
      this.differ = new MultiTreeDiff(trees, lastOneWins);
      return;
    }

    this.firstFastbootTree = trees.length;
    for (let addon of activeAddonDescendants) {
      let dir = addon.meta['fastboot-js'];
      if (dir) {
        let definitelyDir = join(addon.root, dir);
        this.sourceDirs.push(definitelyDir);
        trees.push({
          mayChange: addon.mayRebuild,
          walk() {
            return walkSync.entries(definitelyDir);
          },
        });
      }
    }
    if (ownFastbootJSDir) {
      trees.push({
        mayChange: true,
        walk() {
          return walkSync.entries(ownFastbootJSDir);
        },
      });
      this.sourceDirs.push(ownFastbootJSDir);
    }
    this.differ = new MultiTreeDiff(trees, fastbootMerge(this.firstFastbootTree));
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
            let sourceDir = this.sourceDirs[sourceIndices[0]];
            let sourceFile = join(sourceDir, relativePath);
            copySync(sourceFile, outputPath, { dereference: true });
            this.updateFiles(relativePath, sourceDir, sourceFile);
          } else {
            // we have both fastboot and non-fastboot files for this path.
            // Because of the way fastbootMerge is written, the first one is the
            // non-fastboot.
            this.isFastbootOnly.set(relativePath, false);
            let [browserDir, fastbootDir] = sourceIndices.map(i => this.sourceDirs[i]);
            let browserFile = join(browserDir, relativePath);
            let browserContents = readFileSync(browserFile, 'utf8');
            let fastbootContents = readFileSync(join(fastbootDir, relativePath), 'utf8');
            this.updateFiles(relativePath, browserDir, browserFile);
            console.log(browserContents, fastbootContents);
            throw new Error(`unimplemented fastboot merge`);
          }
          break;
        default:
          assertNever(operation);
      }
    }
  }

  private updateFiles(relativePath: string, sourceDir: string, sourceFile: string) {
    switch (sourceDir) {
      case this.ownAppJSDir:
      case this.ownFastbootJSDir:
        this.files.set(relativePath, null);
        break;
      default:
        this.files.set(relativePath, sourceFile);
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
