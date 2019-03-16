import { PackageRules } from "@embroider/core";

let rules: PackageRules = {
  package: 'ember-basic-dropdown',
  modules: {
    './components/basic-dropdown.js': {
      dependsOnComponents: [
        '{{basic-dropdown/trigger}}',
        '{{basic-dropdown/content}',
      ]
    },
    './templates/components/basic-dropdown.hbs': {
      dynamicComponentSources: {
        triggerComponent: { fromArgument: "triggerComponent" },
        contentComponent: { fromArgument: "triggerComponent" },
      }
    }
  }
};

export default [ rules ];
