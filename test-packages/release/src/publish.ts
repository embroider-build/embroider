import execa from 'execa';
import { loadSolution, Solution } from './plan';
import { dirname } from 'path';
import { Octokit } from '@octokit/rest';

async function hasCleanRepo(): Promise<boolean> {
  let result = await execa('git', ['status', '--porcelain=v1'], { cwd: __dirname });
  return result.stdout.length === 0;
}

function tagFor(pkgName: string, entry: { newVersion: string }): string {
  return `v${entry.newVersion}-${pkgName.replace(/^@embroider\//, '')}`;
}

class IssueReporter {
  hadIssues = false;
  reportFailure(message: string): void {
    this.hadIssues = true;
    process.stderr.write(message);
  }
}

async function makeTags(solution: Solution, reporter: IssueReporter): Promise<void> {
  for (let [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }
    try {
      await execa('git', ['tag', tagFor(pkgName, entry)], {
        cwd: dirname(entry.pkgJSONPath),
        stderr: 'inherit',
        stdout: 'inherit',
      });
    } catch (err) {
      reporter.reportFailure(`Failed to create tag for ${pkgName}`);
    }
  }
}

async function push(reporter: IssueReporter) {
  try {
    await execa('git', ['push', '--tags'], { cwd: __dirname });
  } catch (err) {
    reporter.reportFailure(`Failed to git push`);
  }
}

async function createGithubRelease(octokit: Octokit, description: string): Promise<void> {}

export async function publish(opts: { skipRepoSafetyCheck?: boolean }) {
  if (!opts.skipRepoSafetyCheck) {
    if (!(await hasCleanRepo())) {
      process.stderr.write(`You have uncommitted changes.
To publish a release you should start from a clean repo. Run "embroider-release prepare", then commit the changes, then come back and run "embroider-release publish.
`);
      process.exit(-1);
    }
  }

  let { solution, description } = loadSolution();

  if (!process.env.GITHUB_AUTH) {
    process.stderr.write(`You need to set GITHUB_AUTH.`);
    process.exit(-1);
  }
  let octokit = new Octokit({ auth: process.env.GITHUB_AUTH });

  // from this point forward we don't stop if something goes wrong, we just keep
  // track of whether anything went wrong so we can use the right exit code at
  // the end.
  let reporter = new IssueReporter();

  //await makeTags(solution, reporter);
  //await push(reporter);
  await createGithubRelease(octokit, description);

  if (reporter.hadIssues) {
    process.stderr.write(`\nSome parts of the release were unsuccessful.\n`);
    process.exit(-1);
  } else {
    process.stdout.write(`\nSuccessfully published release\n`);
  }
}
