import Application from '@ember/application';
import Resolver from 'ember-resolver';

class App extends Application {
  Resolver = Resolver.withModules({});
}

export async function render(url) {
  let result = await App.create({
    autoboot: false,
    modulePrefix: 'spike',
  }).visit(url);
  return result;
}
