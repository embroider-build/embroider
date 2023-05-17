import { parseChangeLogOrExit } from './change-parser';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { planVersionBumps, serializeSolution, Solution } from './plan';
import { readJSONSync, writeJSONSync } from 'fs-extra';

const changelogPreamble = `# Embroider Changelog
`;

function updateChangelog(newChangelogContent: string, solution: Solution) {
  let targetChangelogFile = resolve(__dirname, '..', '..', '..', 'CHANGELOG.md');
  let oldChangelogContent = readFileSync(targetChangelogFile, 'utf8');
  if (!oldChangelogContent.startsWith(changelogPreamble)) {
    process.stderr.write(`Cannot parse existing changelog. Expected it to start with:\n${changelogPreamble}`);
    process.exit(-1);
  }
  oldChangelogContent = oldChangelogContent.slice(changelogPreamble.length);

  let [firstNewLine, ...restNewLines] = newChangelogContent.trim().split('\n');

  writeFileSync(
    targetChangelogFile,
    changelogPreamble +
      firstNewLine +
      '\n\n' +
      versionSummary(solution) +
      '\n' +
      restNewLines.join('\n') +
      '\n' +
      oldChangelogContent
  );
}

function versionSummary(solution: Solution): string {
  let result: string[] = [];
  for (let [pkgName, entry] of solution) {
    if (entry.impact) {
      result.push(`${pkgName} ${entry.newVersion} (${entry.impact})`);
    }
  }
  return result.join('\n');
}

function updateVersions(solution: Solution) {
  for (let entry of solution.values()) {
    if (entry.impact) {
      let pkg = readJSONSync(entry.pkgJSONPath);
      pkg.version = entry.newVersion;
      writeJSONSync(entry.pkgJSONPath, pkg, { spaces: 2 });
    }
  }
}

export async function prepare(newChangelogContent: string) {
  let changes = parseChangeLogOrExit(newChangelogContent);
  let solution = planVersionBumps(changes);
  updateVersions(solution);
  updateChangelog(newChangelogContent, solution);
  writeFileSync(resolve(__dirname, '..', '..', '..', '.release-plan.json'), serializeSolution(solution));
  return solution;
}
