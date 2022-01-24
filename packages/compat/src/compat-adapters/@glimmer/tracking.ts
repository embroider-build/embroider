import V1Addon from '../../v1-addon';
import Plugin from 'broccoli-plugin';
import { join } from 'path';
import { outputFileSync, copyFileSync } from 'fs-extra';

/*
  @glimmer/tracking is a real package but it has no working implementation. The
  real implementation is in ember-source.

  Since embroider prioritizes real packages, it's best to provide a compat
  adapter here to make it into a valid package. It's easy enough for it to
  reexport the things from ember that are needed.
*/
class RedirectToEmber extends Plugin {
  private didBuild = false;

  build() {
    if (!this.didBuild) {
      copyFileSync(join(this.inputPaths[0], 'package.json'), join(this.outputPath, 'package.json'));
      outputFileSync(join(this.outputPath, 'index.js'), `export { tracked } from '@ember/-internals/metal';`);
      outputFileSync(
        join(this.outputPath, 'primitives', 'cache.js'),
        `export { cached, createCache, getValue, isConst } from "@ember/-internals/metal";`
      );
      this.didBuild = true;
    }
  }
}

export default class extends V1Addon {
  get v2Tree() {
    return new RedirectToEmber([super.v2Tree]);
  }
}
