import V1Addon from '../v1-addon';
import { addPeerDependency } from '../compat-utils';

export default class extends V1Addon {
  get packageJSON() {
    // active-model-adapter has an unstated peer dependency on ember-data. The
    // old build system allowed this kind of sloppiness, the new world does not.
    return addPeerDependency(super.packageJSON, 'ember-data');
  }
}
