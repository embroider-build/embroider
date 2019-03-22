import EmberRouter from '@ember/routing/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('helpers-example');
  this.route('components-example');
  this.route('static-component-rules-example');
  this.route('split-me', function() {
    this.route('child');
  });
});

export default Router;
