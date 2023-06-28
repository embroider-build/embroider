import assertNever from 'assert-never';
import FSTree from 'fs-tree-diff';
import walkSync from 'walk-sync';
import { resolve } from 'path';
import { copySync, mkdirpSync, removeSync, rmdirSync, unlinkSync } from 'fs-extra';

// mirrors the changes in the src dir to the dest dir, while tracking the
// current set of files present.
export class SyncDir {
  private prev: FSTree = new FSTree();
  readonly files: Set<string> = new Set();

  constructor(private src: string, private dest: string) {}

  update(): void {
    let next = new FSTree({
      entries: walkSync.entries(this.src),
    });
    for (let [operation, relativePath] of this.prev.calculatePatch(next)) {
      let outputPath = resolve(this.dest, relativePath);
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
          copySync(resolve(this.src, relativePath), outputPath, { dereference: true });
          break;
        case 'create':
          copySync(resolve(this.src, relativePath), outputPath, { dereference: true });
          this.files.add(relativePath);
          break;
        default:
          assertNever(operation);
      }
      this.prev = next;
    }
  }
}
