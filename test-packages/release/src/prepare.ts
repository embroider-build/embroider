import { parseChangeLogOrExit, ParsedChangelog, UnlabeledSection } from './change-parser';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { highlightMarkdown } from './highlight';

const changelogPreamble = `# Embroider Changelog
`;

function ensureAllLabeled(changes: ParsedChangelog) {
  let unlabeled = changes.sections.find(section => 'unlabeled' in section) as UnlabeledSection;
  if (unlabeled) {
    process.stderr.write('Cannot release because these PRs are unlabeled:\n');
    process.stderr.write(highlightMarkdown(unlabeled.summaryText));
    process.exit(-1);
  }
}

function updateChangelog(newChangelogContent: string) {
  let targetChangelogFile = resolve(__dirname, '..', '..', '..', 'CHANGELOG.md');
  let oldChangelogContent = readFileSync(targetChangelogFile, 'utf8');
  if (!oldChangelogContent.startsWith(changelogPreamble)) {
    process.stderr.write(`Cannot parse existing changelog. Expected it to start with:\n${changelogPreamble}`);
    process.exit(-1);
  }
  oldChangelogContent = oldChangelogContent.slice(changelogPreamble.length);
  writeFileSync(targetChangelogFile, changelogPreamble + newChangelogContent + '\n' + oldChangelogContent);
}

export async function prepare(newChangelogContent: string) {
  let changes = parseChangeLogOrExit(newChangelogContent);
  ensureAllLabeled(changes);
  updateChangelog(newChangelogContent);
}
