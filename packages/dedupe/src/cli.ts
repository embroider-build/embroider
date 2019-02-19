#!/usr/bin/env node
import yargs from 'yargs';

const argv = yargs
  .option('project-dir', { alias: 'd', default: process.cwd() })
  .command(['*', 'inspect'], "prints a summary of duplicated ember addons", {}, async () => {
    let mod = await import('./index');
    await mod.inspect(argv);
  })
  .argv;
