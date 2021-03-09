import Funnel from 'broccoli-funnel';
import broccoliMergeTrees from 'broccoli-merge-trees';
import V1Addon from '../v1-addon';

export default class extends V1Addon {
  get newPackageJSON() {
    let extra = {
      './dist/ember-template-compiler.js': './dist/ember-template-compiler.js',
    };
    let pkg = JSON.parse(JSON.stringify(super.newPackageJSON));
    if (!pkg.exports) {
      pkg.exports = extra;
    } else {
      Object.assign(pkg.exports, extra);
    }
    return pkg;
  }
  get v2Tree() {
    return broccoliMergeTrees([
      super.v2Tree,
      new Funnel(this.rootTree, { include: ['dist/ember-template-compiler.js'] }),
    ]);
  }
}
