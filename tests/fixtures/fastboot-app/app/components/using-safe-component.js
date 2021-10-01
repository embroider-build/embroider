import Component from '@glimmer/component';
import Ember from 'ember';
import { hbs } from 'ember-cli-htmlbars';
import { ensureSafeComponent } from '@embroider/util';

class OtherComponent extends Component {}
// Required to avoid a transpilation failure on Ember < 3.28 ATM (the
// `@ember/component` module reference was not being replaced as expected
// under 3.24)
Ember._setComponentTemplate(hbs`<p data-safe-component>Safe Component here!!</p>`, OtherComponent);

export default class extends Component {
  OtherComponent = ensureSafeComponent(OtherComponent, this);
}
