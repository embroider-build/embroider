import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { mergeWithUniq } from './merges';

export default class SmooshPackageJSON extends Plugin {
  constructor(inputTrees: Node[], opts: { annotation?: string } = {}) {
    super(inputTrees, {
      annotation: `embroider:core:smoosh-package-json:${opts?.annotation}`,
      persistentOutput: true,
      needsCache: false,
    });
  }

  build() {
    let pkgs = this.inputPaths.map(p => {
      let pkgPath = join(p, 'package.json');
      if (existsSync(pkgPath)) {
        return JSON.parse(readFileSync(pkgPath, 'utf8'));
      }
    });
    let pkg = mergeWithUniq({}, ...pkgs);
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
