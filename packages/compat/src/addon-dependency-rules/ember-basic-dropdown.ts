import { PackageRules } from "../dependency-rules";

let rules: PackageRules = {
  name: 'ember-basic-dropdown',
  modules: {
    './components/basic-dropdown.js': {
      dependsOnComponents: [
        '{{basic-dropdown/trigger}}',
        '{{basic-dropdown/content}',
      ]
    },
    './templates/components/basic-dropdown.hbs': {
      dynamicComponents: {
        triggerComponent: { fromComponent: "{{basic-dropdown}}" },
        contentComponent: { fromComponent: "{{basic-dropdown}}" },
      }
    }
  }
};

export default [ rules ];
