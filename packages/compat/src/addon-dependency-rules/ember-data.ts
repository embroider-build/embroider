import { PackageRules } from '..';

let rules: PackageRules[] = [
  {
    package: '@ember-data/store',
    semverRange: '<=4.11.0',
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
