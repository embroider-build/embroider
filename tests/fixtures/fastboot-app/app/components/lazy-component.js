import Component from '@glimmer/component';
import { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class LazyComponent extends Component {
  @inject fastboot;
  @tracked message = 'loading...';
  @tracked secondMessage = 'loading...';

  constructor(...args) {
    super(...args);
    if (this.fastboot.isFastBoot) {
      this.fastboot.deferRendering(this.loadLibrary());
    } else {
      this.loadLibrary();
    }
  }

  async loadLibrary() {
    // we're loading two libraries here to exercise two different code paths.

    // this one is only used here, so it will be a lazy dependency of the app
    let library = (await import('@embroider/sample-lib')).default;
    this.message = library();

    // this one is used *lazily* here and also used *eagerly* in the test suite.
    // Embroider needs to keep the different straight as its figuring out which
    // lazy chunks to preload for fastboot.
    let secondLib = (await import('@embroider/second-sample-lib')).default;
    this.secondMessage = secondLib();
    window.lazyComponentDone = true;
  }
}
