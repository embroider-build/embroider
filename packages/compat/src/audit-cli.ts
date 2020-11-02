#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { Audit, isBuildError } from './audit';

// slightly wacky because yargs types don't cover this, but you can't access the
// other documented place to find `hideBin` on node < 12.17
const { hideBin } = (yargs as any) as {
  hideBin(argv: readonly string[]): readonly string[];
};

function runCLI() {
  return yargs(hideBin(process.argv)).command(
    '$0',
    'audit your app for embroider compatibility problems',
    yargs => {
      return yargs
        .option('debug', {
          alias: 'd',
          type: 'boolean',
          description: 'Add debug logging about the audit itself',
          default: false,
        })
        .option('json', {
          alias: 'j',
          type: 'boolean',
          description: 'Print results in JSON format',
          default: false,
        })
        .option('reuse-build', {
          alias: 'r',
          type: 'boolean',
          description: 'Reuse previous build',
          default: false,
        })
        .option('app', {
          type: 'string',
          description: 'Path to your app',
          default: process.cwd(),
        })
        .fail(function (_, err, _yargs) {
          if (isBuildError(err)) {
            process.stderr.write(err.message + '\n');
          } else {
            console.error(err);
          }
          process.exit(1);
        });
    },
    async options => {
      let results = await Audit.run(options);
      if (options.json) {
        process.stdout.write(JSON.stringify(results, null, 2) + '\n');
      } else {
        process.stdout.write(results.humanReadable());
      }
      process.exit(results.perfect ? 0 : 1);
    }
  ).argv;
}

if (require.main === module) {
  runCLI();
}
