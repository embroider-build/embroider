#!/usr/bin/env node
import yargs from 'yargs';

const argv = yargs
  .option('project-dir', { alias: 'p', default: process.cwd() })
  .option('level', {
    default: 'only-addons',
    choices: ['only-addons', 'addons-and-deps', 'all'],
    desc: "Controls how deeply we will traverse when attemping to deduplicate. The biggest benefit often comes from deduplicating `ember-addons` and you don't need to go deeper. But if those addons are auto-importing non-ember-addon dependencies, you can benefit from `addons-and-deps`. If you want to wait for your entire node_modules to be optimized, use `all`."
  })
  .command(['*', 'inspect'], "prints a summary of duplicated ember addons", {}, async () => {
    let mod = await import('./index');
    await mod.inspect(argv);
  })
  .argv;
