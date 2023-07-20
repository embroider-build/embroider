import Route from '@ember/routing/route';
import { service } from '@ember/service';
export default class extends Route {
  @service store;
  async model() {
    await this.store.findRecord('post', 1);
  }
}
