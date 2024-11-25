import { ensurePrebuild, processRouteTemplate } from './steps.js';

async function main() {
  await ensurePrebuild();
  await processRouteTemplate('app/templates/login.hbs');
}

await main();
