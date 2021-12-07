import writeFile from 'broccoli-file-creator';
import V1Addon from '../v1-addon';

// Because almost every addon depends on ember-cli-babel, and because ember-cli
// instantiates a separate instance of Addon per consumer, approximately *half*
// of all Addon instances in a typical app will be copies of ember-cli-babel.
//
// Under embroider, *all* of them should be contributing no files to the build.
export default class EmberCliBabel extends V1Addon {
  // this ensures we don't bother smooshing together a large number of useless
  // copies of the addon.
  hasAnyTrees() {
    return false;
  }

  // and the one copy that we do emit should just be an empty valid package. We
  // don't want the babel helpers it emits, they're not even used under
  // Embroider anyway.
  get v2Tree() {
    return writeFile('package.json', JSON.stringify(this.newPackageJSON, null, 2));
  }
}
