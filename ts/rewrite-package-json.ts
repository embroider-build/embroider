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

  private cachedLast;

  get lastPackageJSON() {
    if (!this.cachedLast) {
      throw new Error(`tried to access package.json contents for a package that hasn't been build yet`);
    }
    return this.cachedLast;
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
    this.cachedLast = pkg;
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
