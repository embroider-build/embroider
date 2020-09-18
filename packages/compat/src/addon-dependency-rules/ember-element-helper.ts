import { PackageRules } from '..';

let rules: PackageRules = {
  package: 'ember-element-helper',
  addonModules: {
    'helpers/-element.js': {
      dependsOnComponents: ['{{-dynamic-element}}', '{{-dynamic-element-alt}}'],
    },
  },
  components: {},
};

export default [rules];
