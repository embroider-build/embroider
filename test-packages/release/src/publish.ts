import execa from 'execa';

async function hasCleanRepo(): Promise<boolean> {
  let result = await execa('git', ['status', '--porcelain=v1'], { cwd: __dirname });
  return result.stdout.length === 0;
}

export async function publish() {
  if (!(await hasCleanRepo())) {
    process.stderr.write(`You have uncommitted changes.
To publish a release you should start from a clean repo. Run "embroider-release prepare", then commit the changes, then come back and run "embroider-release publish.
`);
    process.exit(-1);
  }
}
