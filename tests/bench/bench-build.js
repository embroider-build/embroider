import execa from 'execa';
import { bench, run } from 'mitata';
import { rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'release-typescript-app' },
    command: { type: 'string', default: 'pnpm build' },
    outdir: { type: 'string', default: 'output' },
    keep: { type: 'boolean', default: false },
  },
});

const scenario = values.scenario;
const command = values.command;
const outdir = values.outdir;
const keep = values.keep;

if (!scenario) {
  console.error('Missing required --scenario <name>');
  process.exit(1);
}

const scenariosDir = join(import.meta.dirname, '../scenarios');
const outputDir = join(scenariosDir, outdir);

async function main() {
  await execa(
    'scenario-tester',
    ['output', '--scenario', scenario, '--outdir', outdir, '--require', 'ts-node/register', '--files', '*-test.ts'],
    { stdio: 'inherit', preferLocal: true, cwd: scenariosDir }
  );

  bench(`${scenario}: ${command}`, async () => {
    await execa(command, { cwd: outputDir, shell: true });
  }).gc('inner');

  await run();
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    if (!keep) {
      await rm(outputDir, { recursive: true, force: true });
    } else {
      console.log(`\n> keeping output folder at ${outputDir}`);
    }
  });
