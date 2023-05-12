import execa from 'execa';

export async function gatherChanges() {
  let result = await execa('pnpm', ['lerna-changelog', '--next-version', 'Release']);
  return result.stdout;
}
