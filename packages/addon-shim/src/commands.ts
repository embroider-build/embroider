#!/usr/bin/env node

import { ensureSymlinkSync, readJSONSync, writeJSONSync } from 'fs-extra';
import { join } from 'path';
import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';

function commonArgs(yargs: Argv) {
  return yargs
    .option('testAppDir', {
      type: 'string',
      description: 'Path to the test app',
      default: 'test-app',
    })
    .option('addonDir', {
      type: 'string',
      description: 'Path to your addon',
      default: process.cwd(),
    });
}

yargs(process.argv.slice(2))
  .scriptName('addon-shim')
  .command(
    'link-test-app',
    'Ensures that a test app (that lives a subdir under an addon) has access to the addon and all appropriate deps',
    (yargs) => commonArgs(yargs),
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
      return commonArgs(yargs).option('lint', {
        type: 'boolean',
        description:
          'Instead of modifying package.json, print what would have been modified and exit with a failure if any changes are required.',
        default: false,
      });
    },
    function (opts) {
      let { testAppDir, addonDir, lint } = opts;
      let addonPkg = readJSONSync(join(addonDir, 'package.json'));
      let testPkg = readJSONSync(join(testAppDir, 'package.json'));
      let foundDifferences = false;
      let devDeps: { [name: string]: string } = Object.assign(
        {},
        addonPkg.devDependencies
      );
      for (let [name, range] of Object.entries(
        testPkg.devDependencies as { [name: string]: string }
      )) {
        if (name === addonPkg.name) {
          continue;
        }
        if (devDeps[name] !== range) {
          foundDifferences = true;
          if (lint) {
            console.error(
              `test app depends on ${name} ${range} but that is not present in addon's devDependencies package.json`
            );
          } else {
            devDeps[name] = range;
          }
        }
      }
      if (!foundDifferences) {
        return;
      }
      if (lint) {
        process.exit(-1);
      } else {
        addonPkg.devDependencies = devDeps;
        writeJSONSync(join(addonDir, 'package.json'), addonPkg, { spaces: 2 });
      }
    }
  )
  .demandCommand()
  .strictCommands()
  .help().argv;
