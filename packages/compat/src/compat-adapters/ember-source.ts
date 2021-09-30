import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';

export default class extends V1Addon {
  get v2Tree() {
    return mergeTrees([super.v2Tree, buildFunnel(this.rootTree, { include: ['dist/ember-template-compiler.js'] })]);
  }
}
