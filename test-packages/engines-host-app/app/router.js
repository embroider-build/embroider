import EmberRouter from '@embroider/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL,
});

Router.map(function() {
  this.route('use-eager-engine');
  this.mount('lazy-engine', { path: '/use-lazy-engine', as: 'use-lazy-engine' });
  this.route('style-check');
});

export default Router;
