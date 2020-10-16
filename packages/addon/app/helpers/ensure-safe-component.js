import { ensureSafeComponent } from '@embroider/addon';
import Helper from '@ember/component/helper';
export default class extends Helper {
  compute([value]) {
    return ensureSafeComponent(value, this);
  }
}
