import Controller from '@ember/controller';
import { getOwnConfig } from '@embroider/macros';

export default Controller.extend({
  init(args) {
    this._super(args);
    this.mode = getOwnConfig()['mode'];
  }
});
