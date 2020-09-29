import V1Addon from '../v1-addon';
import { addPeerDependency } from '../compat-utils';

export default class extends V1Addon {
  get packageJSON() {
    return addPeerDependency(super.packageJSON, 'ember-data');
  }
}
