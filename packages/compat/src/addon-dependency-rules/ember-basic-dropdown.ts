import { PackageRules } from '..';

let rulesForV1: PackageRules = {
  package: 'ember-basic-dropdown',
  semverRange: '1.x',
  addonModules: {
    'components/basic-dropdown.js': {
      dependsOnComponents: ['{{basic-dropdown/trigger}}', '{{basic-dropdown/content}}'],
    },
  },
  components: {
    '{{basic-dropdown}}': {
      layout: {
        addonPath: 'templates/components/basic-dropdown.hbs',
      },
      acceptsComponentArguments: ['triggerComponent', 'contentComponent'],
    },
  },
};

let rulesForV2: PackageRules = {
  package: 'ember-basic-dropdown',
  semverRange: '>=2.0.0 <=3.0.18',
  addonModules: {
    'components/basic-dropdown.js': {
      dependsOnComponents: ['{{basic-dropdown-trigger}}', '{{basic-dropdown-content}}'],
    },
  },
  components: {
    '{{basic-dropdown}}': {
      layout: {
        addonPath: 'templates/components/basic-dropdown.hbs',
      },
      acceptsComponentArguments: ['triggerComponent', 'contentComponent'],
    },
  },
};

export default [rulesForV1, rulesForV2];
