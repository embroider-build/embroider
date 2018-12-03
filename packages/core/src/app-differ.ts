import Package from "./package";
import MultiTreeDiff, { InputTree } from "./multi-tree-diff";
import walkSync from 'walk-sync';
import { join } from 'path';
import { mkdirpSync, unlinkSync, rmdirSync, removeSync, copySync } from "fs-extra";

export default class AppDiffer {
  private differ: MultiTreeDiff;
  private sourceDirs: string[] = [];

  readonly files: Set<string> = new Set();

  constructor(private outputPath: string, ownAppJSDir: string, activeAddonDescendants: Package[]) {
    let trees = activeAddonDescendants
      .map((addon): InputTree | undefined => {
        let dir = addon.meta['app-js'];
        if (dir) {
          let definitelyDir = join(addon.root, dir);
          this.sourceDirs.push(definitelyDir);
          return {
            mayChange: addon.mayRebuild,
            walk() {
              return walkSync.entries(definitelyDir);
            }
          };
        }
      }).filter(Boolean) as InputTree[];

    trees.push({
      mayChange: true,
      walk() {
        return walkSync.entries(ownAppJSDir);
      }
    });
    this.sourceDirs.push(ownAppJSDir);
    this.differ = new MultiTreeDiff(trees);
  }

  update() {
    let { ops, sources } = this.differ.update();
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
          copySync(join(this.sourceDirs[sources.get(relativePath)!], relativePath), outputPath, { dereference: true });
          this.files.add(relativePath);
          break;
        default:
          assertNever(operation);
      }
    }
  }
}

function assertNever(_: never) {}
