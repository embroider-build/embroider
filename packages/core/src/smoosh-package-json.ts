import Plugin from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mergeWithUniq } from './merges';

export default class SmooshPackageJSON extends Plugin {
  constructor(inputTrees) {
    super(inputTrees, {
      annotation: 'embroider:core:smoosh-package-json'
    });
  }

  private cachedLast;

  get lastPackageJSON() {
    if (!this.cachedLast) {
      throw new Error(`tried to access package.json contents for a smooshed package that hasn't been build yet`);
    }
    return this.cachedLast;
  }

  build() {
    let pkgs = this.inputPaths.map(p => JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')));
    let pkg = mergeWithUniq({}, ...pkgs);
    this.cachedLast = pkg;
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
