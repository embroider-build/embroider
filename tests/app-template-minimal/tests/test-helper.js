import Application from 'app-template-minimal/app';
import config from 'app-template-minimal/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';
import { enterTestMode } from 'app-template-minimal/config/environment';

export function start() {
  enterTestMode();
  setApplication(Application.create(config.APP));
  setup(QUnit.assert);
  setupEmberOnerrorValidation();
  qunitStart();
}
