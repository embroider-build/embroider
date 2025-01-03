import { ensureAppSetup, ensurePrebuild, processRouteTemplate } from './steps.js';
import { resolve } from 'path';

async function main() {
  await ensureAppSetup();
  await ensurePrebuild();
  await processRouteTemplate(resolve('app/templates/calculator.hbs'));
}

await main();
