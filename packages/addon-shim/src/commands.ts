#!/usr/bin/env node

import { ensureSymlinkSync, readJSONSync, writeJSONSync } from 'fs-extra';
import { join } from 'path';
import yargs from 'yargs/yargs';

yargs(process.argv.slice(2))
  .scriptName('addon-shim')
  .command(
    'link-test-app',
    'Ensures that a test app (that lives a subdir under an addon) has access to the addon and all appropriate deps',
    (yargs) => {
      return yargs
        .option('testAppDir', {
          type: 'string',
          description: 'Path to the test app',
          default: 'tests',
        })
        .option('addonDir', {
          type: 'string',
          description: 'Path to your addon',
          default: process.cwd(),
        });
    },
    function (opts) {
      let { testAppDir, addonDir } = opts;
      ensureSymlinkSync(
        join(addonDir, 'node_modules', '.bin'),
        join(testAppDir, 'node_modules', '.bin'),
        'dir'
      );
      ensureSymlinkSync(
        addonDir,
        join(
          testAppDir,
          'node_modules',
          readJSONSync(join(addonDir, 'package.json')).name
        )
      );
    }
  )
  .command(
    'sync-dev-deps',
    `Synchronizes a test app's devDependencies into the parent addon's devDependencies`,
    (yargs) => {
      return yargs
        .option('testAppDir', {
          type: 'string',
          description: 'Path to the test app',
          default: 'tests',
        })
        .option('addonDir', {
          type: 'string',
          description: 'Path to your addon',
          default: process.cwd(),
        });
    },
    function (opts) {
      let { testAppDir, addonDir } = opts;
      let addonPkg = readJSONSync(join(addonDir, 'package.json'));
      let testPkg = readJSONSync(join(testAppDir, 'package.json'));
      let devDeps: { [name: string]: string } = {};
      for (let [name, range] of Object.entries(
        testPkg.devDependencies as { [name: string]: string }
      )) {
        if (name !== addonPkg.name) {
          devDeps[name] = range;
        }
      }
      addonPkg.devDependencies = devDeps;
      writeJSONSync(join(addonDir, 'package.json'), addonPkg, { spaces: 2 });
    }
  )
  .demandCommand()
  .strictCommands()
  .help().argv;
