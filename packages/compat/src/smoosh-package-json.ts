import Plugin, { Tree } from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mergeWithUniq } from './merges';

export default class SmooshPackageJSON extends Plugin {
  constructor(inputTrees: Tree[]) {
    super(inputTrees, {
      annotation: 'embroider:core:smoosh-package-json'
    });
  }

  build() {
    let pkgs = this.inputPaths.map(p => JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')));
    let pkg = mergeWithUniq({}, ...pkgs);
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
