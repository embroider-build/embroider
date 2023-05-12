import yargs from 'yargs/yargs';
import { readFileSync } from 'fs';

yargs(process.argv.slice(2))
  .usage(
    `Most of the subcommands in here exist so you can easily test parts of the release process by themselves. To do an actual release, see RELEASE.md.`
  )
  .scriptName('release')
  .command(
    'prepare',
    `Edits the package.json and changelog files to prepare for release.`,
    yargs =>
      yargs.option('fromStdin', {
        type: 'boolean',
        description: 'Read the summary of changes from stdin instead of building them from scratch.',
      }),
    async function (opts) {
      let newChangelogContent: string;
      if (opts.fromStdin) {
        newChangelogContent = readFileSync(process.stdin.fd, 'utf8');
      } else {
        let { gatherChanges } = await import('./gather-changes');
        newChangelogContent = await gatherChanges();
      }
      let { prepare } = await import('./prepare');
      await prepare(newChangelogContent);
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
    `Takes the output of gather-changes and parses it into a structured format`,
    yargs => yargs,
    async function (/* opts */) {
      let { parseChangeLogOrExit } = await import('./change-parser');
      console.log(JSON.stringify(parseChangeLogOrExit(readFileSync(process.stdin.fd, 'utf8')), null, 2));
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

  .demandCommand()
  .strictCommands()
  .help().argv;
