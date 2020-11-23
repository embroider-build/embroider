import Service from '@ember/service';
import { getOwner } from '@ember/application';

export default class EnsureRegisteredService extends Service {
  classNonces = new WeakMap();
  nonceCounter = 0;

  register(klass, owner = getOwner(this)) {
    let nonce = this.classNonces.get(klass);
    if (nonce == null) {
      nonce = `-ensure${this.nonceCounter++}`;
      this.classNonces.set(klass, nonce);
      owner.register(`component:${nonce}`, klass);
    }
    return nonce;
  }
}
