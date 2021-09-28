import Component from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
export default Component.extend({
  // tagged template form:
  layout: hbs`<div class={{embroider-sample-transforms-target}}>Inline</div><span>{{macroDependencySatisfies 'ember-source' '>3'}}</span>`,
  // call expression form:
  extra: hbs('<div class={{embroider-sample-transforms-target}}>Extra</div>'),
});
