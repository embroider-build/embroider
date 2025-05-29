import Application from '@ember/application';
import Resolver from 'ember-resolver';
import { precompileTemplate } from '@ember/template-compilation';

export default class App extends Application {
  Resolver = Resolver.withModules({
    'spike/templates/application': precompileTemplate(`yay spike`),
  });
}
