import Plugin from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import DependencyAnalyzer from './dependency-analyzer';

export default class RewritePackageJSON extends Plugin {
  constructor(inputTree, private analyzer: DependencyAnalyzer, private appJSPath) {
    super([inputTree, analyzer], {
      annotation: 'ember-cli-vanilla-rewrite-package-json'
    });
  }

  build() {
    let pkg = JSON.parse(readFileSync(join(this.inputPaths[0], 'package.json'), 'utf8'));
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    pkg['ember-addon']['version'] = 2;
    pkg['ember-addon']['externals'] = this.analyzer.externals;
    if (this.appJSPath) {
      pkg['ember-addon']['app-js'] = this.appJSPath;
    }
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
