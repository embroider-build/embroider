import { ensurePrebuild, processRouteTemplates, processComponentTemplates } from './steps.js';

async function main() {
  await ensurePrebuild();
  await processRouteTemplates();
  await processComponentTemplates();
}

await main();
