import Application from 'dummy/app';
import config from 'dummy/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start as qunitStart } from 'ember-qunit';

export function start() {
  window.LoadedFromCustomAppBoot = true;
  setApplication(Application.create(config.APP));

  setup(QUnit.assert);

  qunitStart();
}