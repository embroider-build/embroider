// import execa from 'execa';
import fs from 'fs';
import { parseChangeLog } from './change-parser';
import { publishedInterPackageDeps } from './interdep';

// async function buildChangelog(): Promise<string> {
//   let result = await execa('pnpm', ['lerna-changelog', '--next-version', 'Embroider Monorepo Release']);
//   return result.stdout;
// }

async function main() {
  let changelog = fs.readFileSync('/tmp/changelog', 'utf8');
  let parsed;
  try {
    parsed = parseChangeLog(changelog);
  } catch (err) {
    console.error(err);
    console.error(`the full changelog that failed to parse was:\n${changelog}`);
    process.exit(-1);
  }
  console.log(JSON.stringify(parsed, null, 2));
  console.log(publishedInterPackageDeps());
}

main().then(
  () => {
    process.exit(0);
  },
  err => {
    console.error(err);
    process.exit(-1);
  }
);
