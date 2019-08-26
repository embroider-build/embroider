import { helper } from '@ember/component/helper';
import ENV from 'dummy/config/environment';

export function reflectUpdatedConfig(/*params, hash*/) {
  return ENV.APP.fromConfigModule;
}

export default helper(reflectUpdatedConfig);
