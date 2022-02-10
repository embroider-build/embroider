import { PackageRules } from '..';

let rules: PackageRules[] = [
  {
    package: '@ember-data/store',
    addonModules: {
      '-private.js': {
        dependsOnModules: ['@ember-data/record-data/-private'],
      },
      '-private/system/core-store.js': {
        dependsOnModules: ['@ember-data/record-data/-private'],
      },
      '-private/system/model/internal-model.js': {
        dependsOnModules: ['@ember-data/model/-private'],
      },
    },
  },
];

export default rules;
