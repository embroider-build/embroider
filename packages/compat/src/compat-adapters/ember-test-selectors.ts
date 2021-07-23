import semver from 'semver';
import V1Addon from '../v1-addon';
import { forceIncludeModule } from '../compat-utils';

export default class extends V1Addon {
  get packageMeta() {
    if (this.addonInstance._stripTestSelectors || semver.satisfies(this.packageJSON.version, '>=6.0.0')) {
      return super.packageMeta;
    } else {
      return forceIncludeModule(super.packageMeta, './utils/bind-data-test-attributes');
    }
  }
}
