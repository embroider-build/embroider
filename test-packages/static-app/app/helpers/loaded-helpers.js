/* global requirejs */
import { helper } from '@ember/component/helper';

export function loadedHelpers() {
  return Object.keys(requirejs.entries)
    .map(k => {
      let m = /^[a-zA-Z0-9_-]+\/helpers\/(.*)/.exec(k);
      if (m) {
        return m[1];
      }
    })
    .filter(Boolean)
    .sort();
}

export default helper(loadedHelpers);
