import Plugin from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export default class RewritePackageJSON extends Plugin {
  constructor(inputTree) {
    super([inputTree], {
      annotation: 'ember-cli-vanilla-rewrite-package-json'
    });
  }

  build() {
    let pkg = JSON.parse(readFileSync(join(this.inputPaths[0], 'package.json'), 'utf8'));
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    pkg['ember-addon']['version'] = 2;
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
