import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';

import { readFileSync } from 'fs';
import { parseChangeLogOrExit } from './change-parser';
import { publish } from './publish';

yargs(process.argv.slice(2))
  .usage(
    `Most of the subcommands in here exist so you can easily test parts of the release process by themselves. To do an actual release, see RELEASE.md.`
  )
  .scriptName('release')
  .command(
    'prepare',
    `Edits the package.json and changelog files to prepare for release.`,
    yargs => fromStdin(yargs),
    async function (opts) {
      let { prepare } = await import('./prepare');
      let solution = await prepare(await newChangelogContent(opts));
      let { explain } = await import('./plan');
      process.stdout.write(explain(solution));
      process.stdout.write(`\nSuccessfully prepared released\n`);
    }
  )
  .command(
    'publish',
    `Publishes an already-prepared released by tagging, pushing tags, creating GitHub release, and publishing to NPM.`,
    yargs =>
      yargs
        .option('skipRepoSafetyCheck', {
          type: 'boolean',
          description:
            'Allows you to run "publish" even if there are uncommitted changes in your repo. Useful only for developing "publish" itself.',
        })
        .option('otp', {
          type: 'string',
          description: 'This is an OTP that will be passed to npm publish',
        })
        .option('dryRun', {
          type: 'boolean',
          description: 'Run through the release, but log to stdout instead of tagging/pushing/publishing',
        }),
    async function (opts) {
      await publish(opts);
    }
  )
  .command(
    'gather-changes',
    `Uses lerna-changelog to build a description of all the PRs in the release.`,
    yargs => yargs,
    async function (/* opts */) {
      let { gatherChanges } = await import('./gather-changes');
      process.stdout.write(await gatherChanges());
    }
  )
  .command(
    'parse-changes',
    `Parse the summary of changes into a structured format`,
    yargs => fromStdin(yargs),
    async function (opts) {
      let { parseChangeLogOrExit } = await import('./change-parser');
      console.log(JSON.stringify(parseChangeLogOrExit(await newChangelogContent(opts)), null, 2));
    }
  )
  .command(
    'discover-deps',
    `Summarizes how all our published packages relate to each other`,
    yargs => yargs,
    async function (/* opts */) {
      let { publishedInterPackageDeps } = await import('./interdep');
      console.log(publishedInterPackageDeps());
    }
  )
  .command(
    'explain-plan',
    `Explains which packages need to be released at what versions and why.`,
    yargs => fromStdin(yargs),
    async function (opts) {
      let { planVersionBumps, explain } = await import('./plan');
      let solution = planVersionBumps(parseChangeLogOrExit(await newChangelogContent(opts)));
      console.log(explain(solution));
    }
  )
  .demandCommand()
  .strictCommands()
  .help().argv;

function fromStdin(yargs: Argv) {
  return yargs.option('fromStdin', {
    type: 'boolean',
    description: 'Read the summary of changes from stdin instead of building them from scratch.',
  });
}

async function newChangelogContent(opts: { fromStdin: boolean | undefined }) {
  let content: string;
  if (opts.fromStdin) {
    content = readFileSync(process.stdin.fd, 'utf8');
  } else {
    let { gatherChanges } = await import('./gather-changes');
    content = await gatherChanges();
  }
  return content;
}
