import Route from '@ember/routing/route';

export default class extends Route {
  async model(): Promise<any> {
    return { message: 'Hello world' };
  }
}
