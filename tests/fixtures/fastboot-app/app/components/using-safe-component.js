import Component from '@glimmer/component';
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { ensureSafeComponent } from '@embroider/util';

class OtherComponent extends Component {}
setComponentTemplate(hbs`<p data-safe-component>Safe Component here!!</p>`, OtherComponent);

export default class extends Component {
  OtherComponent = OtherComponent;
}
