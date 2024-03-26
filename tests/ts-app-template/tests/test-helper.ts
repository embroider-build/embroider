import Application from 'ts-app-template/app';
import config from 'ts-app-template/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start } from 'ember-qunit';
import { setupQunit } from './setup-harness';

setApplication(Application.create(config.APP));

setup(QUnit.assert);

setupQunit();

start();
