import {
  ensureAppSetup,
  ensurePrebuild,
  optionsWithDefaults,
  processComponents,
  processRouteTemplates,
} from './steps.js';

async function main() {
  await ensureAppSetup();
  await ensurePrebuild();
  const opts = optionsWithDefaults({
    relativeLocalPaths: false,
    nativeRouteTemplates: false,
    defaultOutput: 'gts',
    routeTemplates: [],
    components: ['app/components/role-choice.hbs', 'app/components/login.js'],
    templateInsertion: 'end',
  });
  await processRouteTemplates(opts);
  await processComponents(opts);
}

await main();
