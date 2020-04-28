import EmberRouter from '@embroider/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL,
});

Router.map(function() {
  this.mount('eager-engine');
});

export default Router;
