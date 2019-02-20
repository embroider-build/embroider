#!/usr/bin/env node
import yargs from 'yargs';

const argv = yargs
  .option('project-dir', { alias: 'p', default: process.cwd() })
  .option('include-safe-dupes', {
    type: 'boolean',
    default: false,
    desc: 'By default, we will ignore duplicates if those addons are known safe to duplicate. Set this flag to try to deduplicate even those safe things.'
  })
  .option('level', {
    default: 'only-addons',
    choices: ['only-addons', 'addons-and-deps', 'all'],
    desc: "Controls how deeply we will traverse when attemping to deduplicate. The biggest benefit often comes from deduplicating `ember-addons` and you don't need to go deeper. But if those addons are auto-importing non-ember-addon dependencies, you can benefit from `addons-and-deps`. If you want to wait for your entire node_modules to be optimized, use `all`."
  })
  .command(['*', 'inspect'], "prints a summary of duplicated ember addons", {}, async () => {
    let mod = await import('./index');
    await mod.inspect(argv);
  })
  .command(['*', 'plan'], "prints what optimizations we would do", {}, async () => {
    let mod = await import('./index');
    await mod.plan(argv);
  })
  .command(['*', 'run'], "modifies your node_modules directory", {}, async () => {
    let mod = await import('./index');
    await mod.run(argv);
  })
  .argv;
