import assertNever from 'assert-never';
import FSTree from 'fs-tree-diff';
import walkSync from 'walk-sync';
import { resolve } from 'path';
import { copySync, mkdirpSync, removeSync, rmdirSync, unlinkSync } from 'fs-extra';

// mirrors the changes in the src dir to the dest dir, while tracking the
// current set of files present. If dest is undefined, it only tracks the set of
// files without mirroring the changes to anywhere
export class SyncDir {
  private prev: FSTree = new FSTree();
  readonly files: Set<string> = new Set();

  constructor(private src: string, private dest: string | undefined) {}

  update(): void {
    let next = new FSTree({
      entries: walkSync.entries(this.src),
    });
    for (let [operation, relativePath] of this.prev.calculatePatch(next)) {
      let outputPath: string | undefined;
      if (this.dest) {
        outputPath = resolve(this.dest, relativePath);
      }
      switch (operation) {
        case 'unlink':
          if (outputPath) {
            unlinkSync(outputPath);
          }
          this.files.delete(relativePath);
          break;
        case 'rmdir':
          if (outputPath) {
            rmdirSync(outputPath);
          }
          break;
        case 'mkdir':
          if (outputPath) {
            mkdirpSync(outputPath);
          }
          break;
        case 'change':
          if (outputPath) {
            removeSync(outputPath);
            copySync(resolve(this.src, relativePath), outputPath, { dereference: true });
          }
          break;
        case 'create':
          if (outputPath) {
            copySync(resolve(this.src, relativePath), outputPath, { dereference: true });
          }
          this.files.add(relativePath);
          break;
        default:
          assertNever(operation);
      }
      this.prev = next;
    }
  }
}
