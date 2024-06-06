import Application from './app';
import environment from './config/environment';

window.LoadedFromCustomAppBoot = true;
Application.create(environment.APP);