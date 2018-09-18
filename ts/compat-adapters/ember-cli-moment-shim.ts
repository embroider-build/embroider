import V1Addon from "../v1-addon";
import { Memoize } from "typescript-memoize";
import writeFile from 'broccoli-file-creator';
import cloneDeep from 'lodash/cloneDeep';

/*
  ember-cli-moment-shim does some particularly egregious thing. It sets its own
  name to "moment" and then expects its ./addon/*.js will get compiled into the
  "moment" namespace.

  It's one thing to use _runtime_ AMD `define` to stomp another package's name,
  and we fully support that pattern for backward compatibility. But _statically_
  stomping on another packge's module namespace is something we can't tolerate.

  It also extends the underlying moment library by adding `compare` and `clone`
  implementations, which is Not Cool.

  Our workaround here is to emit an "initializer" that does the runtime AMD
  define. We can't use the implicit-script feature because the extensions are
  authored as modules.
*/

export default class EmberData extends V1Addon {
  @Memoize()
  get v2Trees() {
    let trees = super.v2Trees;
    trees.push(writeFile('_app_/initializers/ember-cli-moment-shim.js', shimJS));
    return trees;
  }
  get packageMeta() {
    let meta = cloneDeep(super.packageMeta);
    meta['app-js'] = '_app_';
    return meta;
  }
}

const shimJS = `
import moment from "ember-cli-moment-shim";
window.define('moment', [], function() {
  return moment;
});
export default {
  name: 'ember-cli-moment-shim',
  initialize: function() {}
}
`;
