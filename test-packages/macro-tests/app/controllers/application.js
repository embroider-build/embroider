import Controller from '@ember/controller';
import { getOwnConfig, isTesting, isDeveloping } from '@embroider/macros';

export default Controller.extend({
  init(args) {
    this._super(args);
    this.mode = getOwnConfig()['mode'];
    this.isTesting = isTesting();
    this.isDeveloping = isDeveloping();
  },
});
