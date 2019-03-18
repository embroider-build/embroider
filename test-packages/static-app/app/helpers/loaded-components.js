/* global requirejs */
import { helper } from '@ember/component/helper';

export function loadedComponents() {
  let result = new Set();
  for (let name of Object.keys(requirejs.entries)) {
    let m = /^[a-zA-Z0-9_-]+\/components\/(.*)/.exec(name);
    if (m) {
      result.add(m[1]);
    }
    m = /^[a-zA-Z0-9_-]+\/templates\/components\/(.*)/.exec(name);
    if (m) {
      result.add(m[1]);
    }
  }
  return [...result];
}

export default helper(loadedComponents);
