import Controller from '@ember/controller';
import { getOwnConfig, isTesting, isDevelopingApp } from '@embroider/macros';

export default class Application extends Controller {
  constructor() {
    super(...arguments);
    this.mode = getOwnConfig()['mode'];
    this.isTesting = isTesting();
    this.isDeveloping = isDevelopingApp();
  }
}
