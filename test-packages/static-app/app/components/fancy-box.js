import Component from '@ember/component';
import { computed } from '@ember/object';

export default Component.extend({
  titleComponentWithDefault: computed('titleComponent', function() {
    return this.titleComponent || 'default-title';
  }),
});
