import V1Addon from '../v1-addon';
import { forceIncludeModule } from '../compat-utils';

export default class extends V1Addon {
  get packageMeta() {
    let meta = super.packageMeta;

    // these get invoked from an inline script tag in content-for('test-body-footer')
    meta = forceIncludeModule(meta, './native-xhr');
    meta = forceIncludeModule(meta, './finalize');

    return meta;
  }
}
