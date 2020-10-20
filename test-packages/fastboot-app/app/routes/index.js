import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class IndexRoute extends Route {
  @service
  fastboot;

  beforeModel() {
    // This is only to to make sure we can correctly access the request's host, which fails if FastBoot's `hostWhitelist`
    // is not correctly set up. This is the case when the changes added to /dist/package.json by FastBoot are not correctly
    // merged by Embroider. So this serves as a reproduction of https://github.com/embroider-build/embroider/issues/160
    return this.fastboot.isFastBoot ? this.fastboot.request.host : null;
  }
}
