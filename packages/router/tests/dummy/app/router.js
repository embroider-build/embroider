import EmberRouter from '@embroider/router';
import config from 'dummy/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('split-me', function () {
    this.route('child');
  });
});
