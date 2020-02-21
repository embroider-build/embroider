import { helper } from '@ember/component/helper';

export function duplicatedHelper() {
  return 'from-eager-engine-helper';
}

export default helper(duplicatedHelper);
