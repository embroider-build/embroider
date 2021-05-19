import V1Addon from '../v1-addon';
import { Memoize } from 'typescript-memoize';
import buildFunnel from 'broccoli-funnel';

export default class EmberCLIClipboard extends V1Addon {
  @Memoize()
  get v2Tree() {
    let tree = super.v2Tree;
    return buildFunnel(tree, {
      // ember-cli-clipboard is wrapping *everything* in its vendor tree inside
      // a fastboot guard, including a package.json file. The presence a file
      // named "package.json" that isn't actually valid JSON makes packagers
      // like Webpack barf.
      exclude: ['vendor/clipboard/package.json'],
    });
  }
}
