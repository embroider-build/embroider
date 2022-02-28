import { PackageRules } from '..';

let rules: PackageRules = {
  package: 'ember-power-select',
  semverRange: '< 5.0.1',
  addonModules: {
    './components/power-select.js': {
      dependsOnComponents: [
        '{{power-select/before-options}}',
        '{{power-select/options}}',
        '{{power-select/power-select-group}}',
        '{{power-select/trigger}}',
        '{{power-select/search-message}}',
        '{{power-select/placeholder}}',
      ],
    },
    './components/power-select-multiple.js': {
      dependsOnComponents: ['{{power-select-multiple/trigger}}'],
    },
  },
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
