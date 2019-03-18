import { PackageRules } from "..";

let rules: PackageRules = {
  package: 'ember-basic-dropdown',
  addonModules: {
    'components/basic-dropdown.js': {
      dependsOnComponents: [
        '{{basic-dropdown/trigger}}',
        '{{basic-dropdown/content}',
      ]
    },
  },
  components: {
    '{{basic-dropdown}}': {
      layout: {
        addonPath: "templates/components/basic-dropdown.hbs"
      },
      acceptsComponentArguments: [
        'triggerComponent',
        'contentComponent',
      ]
    }
  }
};

export default [ rules ];
