import Component from '@ember/component';
import { computed } from '@ember/object';
import { dependencySatisfies, macroCondition, importSync } from '@embroider/macros';

if (macroCondition(dependencySatisfies('ember-mocha', '9'))) {
  //importSync('ember-mocha');
  import('ember-websockets');
}

export default Component.extend({
  titleComponentWithDefault: computed('titleComponent', function() {
    return this.titleComponent || 'default-title';
  }),
});
