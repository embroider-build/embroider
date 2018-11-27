import V1Addon from "../v1-addon";
import { join } from 'path';
import { addStripBadReexportsPlugin } from '../compat-utils';

export default class extends V1Addon {
  updateBabelConfig() {
    super.updateBabelConfig();
    addStripBadReexportsPlugin(
      this.options.babel.plugins,
      /ember-composable-helpers\/index\.js$/,
      join(this.root, 'addon')
    );
  }
}
