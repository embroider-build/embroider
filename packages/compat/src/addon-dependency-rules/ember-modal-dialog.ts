import { PackageRules } from '..';

const rules: PackageRules[] = [
  {
    package: 'ember-modal-dialog',
    components: {
      '<ModalDialog/>': {
        invokes: {
          modalDialogComponentName: [
            '{{ember-modal-dialog/-in-place-dialog}}',
            '{{ember-modal-dialog/-liquid-tether-dialog}}',
            '{{ember-modal-dialog/-tether-dialog}}',
            '{{ember-modal-dialog/-liquid-dialog}}',
            '{{ember-modal-dialog/-basic-dialog}}',
          ],
        },
        layout: {
          addonPath: 'templates/components/modal-dialog.hbs',
        },
      },
      '<LiquidWormhole/>': { safeToIgnore: true },
      '<LiquidTether/>': { safeToIgnore: true },
    },
  },
];

export default rules;
