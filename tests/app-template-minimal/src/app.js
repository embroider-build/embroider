import Application from '@ember/application';
import { Resolver } from './resolver';
import * as PageTitleService from 'ember-page-title/services/page-title';

export default class App extends Application {
  Resolver = new Resolver({
    ...import.meta.glob('./router.{gjs,gts,js,ts}', { eager: true }),
    ...import.meta.glob('./{templates,services,routes}/**/*.{gjs,gts,js,ts}', { eager: true }),
    './services/page-title': PageTitleService,
  });
}
