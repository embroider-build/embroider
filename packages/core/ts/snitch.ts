import Funnel from 'broccoli-funnel';
import walkSync from 'walk-sync';
import { unsupported } from './messages';

/*
  This is used to give warnings when addons are emitting badly-behaved broccoli
  trees that don't follow directory-naming conventions.

  We only check on the first build, on the assumption that it's rare to change
  after that.
*/

export default class Snitch extends Funnel {
  private allowedPaths: RegExp;
  private description: string;
  private mustCheck = true;

  constructor(
    inputTree,
    snitchOptions: { allowedPaths: RegExp, description: string },
    funnelOptions: any
  ) {
    super(inputTree, funnelOptions);
    this.allowedPaths = snitchOptions.allowedPaths;
    this.description = snitchOptions.description;
  }

  build() {
    if (this.mustCheck) {
      let badPaths = [];
      walkSync(this.inputPaths[0], { directories: false })
        .map(filename => {
          if (!this.allowedPaths.test(filename)) {
            badPaths.push(filename);
          }
        });
      if (badPaths.length > 0) {
        unsupported(`${this.description} contains unsupported paths: ${badPaths.join(', ')}`);
      }
      this.mustCheck = false;
    }
    return super.build();
  }
}
