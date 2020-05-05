import Component from '@glimmer/component';
import { inject } from '@ember/service';

export default class AddonExampleComponent extends Component {
  @inject addonExample;
}
