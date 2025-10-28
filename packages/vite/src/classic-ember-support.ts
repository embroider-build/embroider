import { hbs } from './hbs.js';
import { scripts } from './scripts.js';
import { compatPrebuild } from './build.js';
import { assets } from './assets.js';
import { contentFor } from './content-for.js';
import { configTargets } from './config-targets.js';

export function classicEmberSupport() {
  return [hbs(), contentFor(), scripts(), compatPrebuild(), assets(), configTargets()];
}
