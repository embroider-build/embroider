import { PackageRules } from '..';

let rules: PackageRules[] = [
  {
    package: '@ember-data/store',
    addonModules: {
      '-private.js': {
        dependsOnModules: ['@ember-data/record-data/-private'],
      },
    },
  },
];

export default rules;
