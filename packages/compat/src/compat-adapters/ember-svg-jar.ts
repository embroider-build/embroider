import V1Addon from '../v1-addon';
import mergeTrees from 'broccoli-merge-trees';
import Plugin from 'broccoli-plugin';
import { readFileSync, writeFileSync, ensureDirSync, pathExistsSync } from 'fs-extra';
import { join } from 'path';

class FixSVGJar extends Plugin {
  build() {
    let helperFile = join(this.inputPaths[0], '_app_', 'helpers', 'svg-jar.js');
    if (pathExistsSync(helperFile)) {
      let source = readFileSync(helperFile, 'utf8');
      source = `import { importSync } from '@embroider/macros';\n` + source.replace(/\brequire\b/g, 'importSync');
      ensureDirSync(join(this.outputPath, '_app_', 'helpers'));
      writeFileSync(join(this.outputPath, '_app_', 'helpers', 'svg-jar.js'), source);
    }
  }
}

export default class extends V1Addon {
  get v2Tree() {
    let orig = super.v2Tree;
    return mergeTrees([orig, new FixSVGJar([orig], { annotation: 'fix-svg-jar' })], { overwrite: true });
  }
}
