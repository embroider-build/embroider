import V1Addon from "../v1-addon";
import { forceIncludeModule } from "../compat-utils";

export default class extends V1Addon {
  get packageMeta() {
    let meta = super.packageMeta;
    meta = forceIncludeModule(meta, 'native-xhr');
    meta = forceIncludeModule(meta, 'finalize');
    return meta;
  }
}
