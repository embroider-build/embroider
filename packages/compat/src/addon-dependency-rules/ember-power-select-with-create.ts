import type { PackageRules } from '..';

const rules: PackageRules[] = [
  {
    package: 'ember-power-select-with-create',
    semverRange: '<3.0.0',
    components: {
      '<PowerSelectWithCreate/>': {
        acceptsComponentArguments: ['powerSelectComponentName', 'suggestedOptionComponent'],
        layout: {
          addonPath: 'templates/components/power-select-with-create.hbs',
        },
      },
    },
    addonModules: {
      'components/power-select-with-create.js': {
        dependsOnComponents: ['<PowerSelect/>', '<PowerSelectWithCreate::SuggestedOption/>'],
      },
    },
  },
];

export default rules;
