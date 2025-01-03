import { ensureAppSetup, ensurePrebuild, optionsWithDefaults, processRouteTemplates } from './steps.js';

async function main() {
  await ensureAppSetup();
  await ensurePrebuild();
  await processRouteTemplates(
    optionsWithDefaults({
      relativeLocalPaths: false,
      nativeRouteTemplates: false,
      defaultOutput: 'gts',
      // routeTemplates: ['app/templates/add-facility.hbs'],
    })
  );
}

await main();
