import Route from '@ember/routing/route';

export default class extends Route {
  async model() {
    return { message: 'Hello world' };
  }
}
