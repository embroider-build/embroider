import { helper } from '@ember/component/helper';

export function duplicatedHelper() {
  return 'from-lazy-in-repo-engine';
}

export default helper(duplicatedHelper);
