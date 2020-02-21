import { helper } from '@ember/component/helper';

export function duplicatedHelper() {
  return 'from-engines-host-app';
}

export default helper(duplicatedHelper);
