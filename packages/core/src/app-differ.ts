import { V2AddonPackage } from './package';
import MultiTreeDiff, { InputTree } from './multi-tree-diff';
import walkSync from 'walk-sync';
import { join } from 'path';
import { mkdirpSync, unlinkSync, rmdirSync, removeSync, copySync } from 'fs-extra';
import { debug } from './messages';
import assertNever from 'assert-never';

export default class AppDiffer {
  private differ: MultiTreeDiff;
  private sourceDirs: string[] = [];

  // maps from each filename in the app to the original directory from whence it
  // came, if it came from an addon. The mapping allows us to preserve
  // resolution semantics so that each of the app files can still resolve
  // relative to where it was authored.
  //
  // files authored within the app map to null
  readonly files: Map<string, string | null> = new Map();

  constructor(private outputPath: string, private ownAppJSDir: string, activeAddonDescendants: V2AddonPackage[]) {
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
                return walkSync.entries(definitelyDir, { ignore: ['**/.*'] });
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
    this.differ = new MultiTreeDiff(trees);
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
          let sourceDir = this.sourceDirs[sources.get(relativePath)!];
          let sourceFile = join(sourceDir, relativePath);
          copySync(sourceFile, outputPath, { dereference: true });
          this.files.set(relativePath, sourceDir === this.ownAppJSDir ? null : sourceFile);
          break;
        default:
          assertNever(operation);
      }
    }
  }
}
