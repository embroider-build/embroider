import Plugin, { Tree } from 'broccoli-plugin';
import { Builder } from 'broccoli';
import { copySync } from 'fs-extra';

// Wraps a broccoli tree such that it (and everything it depends on) will only
// build a single time.
export default class OneShot extends Plugin {
  private builder: Builder;
  private didBuild = false;

  constructor(originalTree: Tree) {
    // from broccoli's perspective, we don't depend on any input trees!
    super([], {
      persistentOutput: true,
    });
    this.builder = new Builder(originalTree);
  }
  async build() {
    if (this.didBuild) {
      return;
    }
    await this.builder.build();
    copySync(this.builder.outputPath, this.outputPath, { dereference: true });
    await this.builder.cleanup();
    this.didBuild = true;
  }
}
