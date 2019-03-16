import { PackageRules } from "@embroider/core";

let rules: PackageRules = {
  name: 'ember-power-select',
  modules: {
    './components/power-select.js': {
      dependsOnComponents: [
        '{{power-select/before-options}}',
        '{{power-select/options}}',
        '{{power-select/power-select-group}}',
        '{{power-select/trigger}}',
        '{{power-select/search-message}}',
        '{{power-select/placeholder}}',
      ]
    },
    './components/power-select-multiple.js': {
      dependsOnComponents: [
        '{{power-select-multiple/trigger}}',
      ]
    },
    './templates/components/power-select.hbs': {
      dynamicComponents: {
        triggerComponent: { fromComponent: "{{power-select}}" },
        beforeOptionsComponent: { fromComponent: "{{power-select}}" },
        searchMessageComponent: { fromComponent: "{{power-select}}" },
        optionsComponent: { fromComponent: "{{power-select}}" },
        afterOptionsComponent: { fromComponent: "{{power-select}}" },
      }
    }
  }
};

export default [ rules ];
