import type { PackageRules } from '..';

let rules: PackageRules = {
  package: 'ember-power-select-typeahead',
  components: {
    '{{power-select-typeahead}}': {
      layout: {
        addonPath: 'templates/components/power-select-typeahead.hbs',
      },
      acceptsComponentArguments: [
        'afterOptionsComponent',
        'beforeOptionsComponent',
        'optionsComponent',
        'placeholderComponent',
        'searchMessageComponent',
        'selectedItemComponent',
        'triggerComponent',
      ],
    },
  },
};

export default [rules];
