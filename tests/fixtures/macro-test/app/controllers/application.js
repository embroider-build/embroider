import Controller from '@ember/controller';
import { getOwnConfig, isTesting, isDevelopingApp, macroCondition, dependencySatisfies } from '@embroider/macros';

export default class Application extends Controller {
  constructor() {
    super(...arguments);
    this.mode = getOwnConfig()['mode'];
    this.isTesting = isTesting();
    this.isDeveloping = isDevelopingApp();

    if (macroCondition(dependencySatisfies('lodash', '^4'))) {
      this.lodashVersion = 'four';
    } else {
      this.lodashVersion = 'three';
    }
  }
}
