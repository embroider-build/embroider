import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';

import { readFileSync } from 'fs';
import { parseChangeLogOrExit } from './change-parser';

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
      await prepare(await newChangelogContent(opts));
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
    'plan-version-bumps',
    `Takes the output of gather-changes and explains which packages need to be released at what versions and why.`,
    yargs => fromStdin(yargs),
    async function (opts) {
      let { planVersionBumps } = await import('./plan');
      console.log(planVersionBumps(parseChangeLogOrExit(await newChangelogContent(opts))).explain());
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
