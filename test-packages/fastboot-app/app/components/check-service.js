import Component from '@glimmer/component';
import { getOwner } from '@ember/application';

export default class CheckServiceComponent extends Component {
  constructor(...args) {
    super(...args);
    let service = getOwner(this).lookup('service:apps-fastboot-only');
    if (service) {
      this.message = service.message;
    }
    /* global requirejs, require */
    if (requirejs.entries['from-fastboot-addon-sample']) {
      this.addonFileValue = require('from-fastboot-addon-sample').default;
    }
  }
}
