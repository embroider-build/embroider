import V1Addon from "../v1-addon";
import { forceIncludeModule } from "../compat-utils";

export default class EmberData extends V1Addon {
  get packageMeta() {
    if (this.addonInstance._stripTestSelectors) {
      return super.packageMeta;
    } else {
      return forceIncludeModule(super.packageMeta, 'utils/bind-data-test-attributes');
    }
    }
}
