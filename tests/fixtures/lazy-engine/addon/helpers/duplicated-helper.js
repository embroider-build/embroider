import { helper } from '@ember/component/helper';

export function duplicatedHelper() {
  return 'from-lazy-engine';
}

export default helper(duplicatedHelper);
