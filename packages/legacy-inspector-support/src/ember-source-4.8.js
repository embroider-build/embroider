import setupGlobal from './common-implementation.js';

/**
 * @import Application from 'ember-source/types/stable/@ember/application'
 */

/**
 * A function to add ember-inspector support to your Ember App if it has an ember-source version of >= 4.8.
 *
 * If you are on an earlier Ember version then you should import from
 * `@embroider/legacy-inspector-support/ember-source-3-28`;
 *
 * @param {Application} app your `@ember/application` Application sub-class
 */
export default function (app) {
  setupGlobal(app, () => import('./modules-4-8.js'));
}
