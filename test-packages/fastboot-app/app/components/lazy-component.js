import Component from '@glimmer/component';
import { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class LazyComponent extends Component {
  @inject fastboot;
  @tracked message = 'loading...';

  constructor(...args) {
    super(...args);
    if (this.fastboot.isFastBoot) {
      this.fastboot.deferRendering(this.loadLibrary());
    } else {
      this.loadLibrary();
    }
  }

  async loadLibrary() {
    let library = (await import('@embroider/sample-lib')).default;
    this.message = library();
    window.lazyComponentDone = true;
  }
}
