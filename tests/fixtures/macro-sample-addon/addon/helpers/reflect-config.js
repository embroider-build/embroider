import { helper } from '@ember/component/helper';
import { getOwnConfig } from '@embroider/macros';

export function reflectConfig(/*params, hash*/) {
  return getOwnConfig();
}

export default helper(reflectConfig);
