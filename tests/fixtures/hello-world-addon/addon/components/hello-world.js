import Component from '@ember/component';
import layout from '../templates/components/hello-world';
import { getOwnConfig } from '@embroider/macros';
export default Component.extend({
  message: 'embroider-sample-transforms-target',
  config: getOwnConfig(),
  layout,
});
