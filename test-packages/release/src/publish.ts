import execa from 'execa';
import { loadSolution, Solution } from './plan';
import { Octokit } from '@octokit/rest';
import { absoluteDirname } from './utils';

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
  reportInfo(message: string): void {
    process.stdout.write(`ℹ️ ${message}`);
  }
}

async function doesTagExist(tag: string, cwd: string) {
  let { stdout } = await execa('git', ['ls-remote', '--tags', 'origin', '-l', tag], {
    cwd,
  });

  return stdout.trim() !== '';
}

async function makeTags(solution: Solution, reporter: IssueReporter): Promise<void> {
  for (let [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }
    try {
      let tag = tagFor(pkgName, entry);
      let cwd = absoluteDirname(entry.pkgJSONPath);

      let preExisting = await doesTagExist(tag, cwd);

      if (preExisting) {
        reporter.reportInfo(`The tag, ${tag}, has already been pushed up for ${pkgName}`);
        return;
      }

      await execa('git', ['tag', tag], {
        cwd,
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

function chooseRepresentativeTag(solution: Solution): string {
  for (let [pkgName, entry] of solution) {
    if (entry.impact) {
      return tagFor(pkgName, entry);
    }
  }
  process.stderr.write('Found no releaseable packages in the plan');
  process.exit(-1);
}

async function createGithubRelease(
  octokit: Octokit,
  description: string,
  tagName: string,
  reporter: IssueReporter
): Promise<void> {
  try {
    await octokit.repos.createRelease({
      owner: 'embroider-build',
      repo: 'embroider',
      tag_name: tagName,
      body: description,
    });
  } catch (err) {
    console.error(err);
    reporter.reportFailure(`Problem while creating GitHub release`);
  }
}

async function pnpmPublish(solution: Solution, reporter: IssueReporter): Promise<void> {
  for (let [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }
    try {
      await execa('pnpm', ['publish', '--access=public'], {
        cwd: absoluteDirname(entry.pkgJSONPath),
        stderr: 'inherit',
        stdout: 'inherit',
      });
    } catch (err) {
      reporter.reportFailure(`Failed to pnpm publish ${pkgName}`);
    }
  }
}

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

  let representativeTag = chooseRepresentativeTag(solution);

  // from this point forward we don't stop if something goes wrong, we just keep
  // track of whether anything went wrong so we can use the right exit code at
  // the end.
  let reporter = new IssueReporter();

  await makeTags(solution, reporter);
  await push(reporter);
  await createGithubRelease(octokit, description, representativeTag, reporter);
  await pnpmPublish(solution, reporter);

  if (reporter.hadIssues) {
    process.stderr.write(`\nSome parts of the release were unsuccessful.\n`);
    process.exit(-1);
  } else {
    process.stdout.write(`\nSuccessfully published release\n`);
  }
}
