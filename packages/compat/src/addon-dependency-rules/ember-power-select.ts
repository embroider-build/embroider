import type { PackageRules } from '..';

let rules: PackageRules = {
  package: 'ember-power-select',
  semverRange: '< 5.0.1',
  components: {
    '{{power-select}}': {
      layout: {
        addonPath: 'templates/components/power-select.hbs',
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
    '{{power-select-multiple}}': {
      layout: {
        addonPath: 'templates/components/power-select-multiple.hbs',
      },
      acceptsComponentArguments: [
        'afterOptionsComponent',
        'beforeOptionsComponent',
        'groupComponent',
        'optionsComponent',
        'placeholderComponent',
        'searchMessageComponent',
        'selectedItemComponent',
        'triggerComponent',
      ],
    },
    '{{power-select/trigger}}': {
      layout: {
        addonPath: 'templates/components/power-select/trigger.hbs',
      },
      acceptsComponentArguments: ['selectedItemComponent', 'placeholderComponent'],
    },
    '{{power-select/options}}': {
      layout: {
        addonPath: 'templates/components/power-select/options.hbs',
      },
      acceptsComponentArguments: ['groupComponent', 'optionsComponent'],
    },
    '{{power-select-multiple/trigger}}': {
      layout: {
        addonPath: 'templates/components/power-select-multiple/trigger.hbs',
      },
      acceptsComponentArguments: ['selectedItemComponent'],
    },
  },
};

export default [rules];
