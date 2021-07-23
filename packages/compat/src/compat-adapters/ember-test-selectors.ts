import V1Addon from '../v1-addon';
import { forceIncludeModule } from '../compat-utils';
import semver from 'semver';

export default class extends V1Addon {
  // v6.0.0 of ember-test-selectors dropped the attribute binding for classic components
  static shouldApplyAdapter(addonInstance: any) {
    return semver.lt(addonInstance.pkg.version, '6.0.0') && !addonInstance._stripTestSelectors;
  }

  get packageMeta() {
    return forceIncludeModule(super.packageMeta, './utils/bind-data-test-attributes');
  }
}
