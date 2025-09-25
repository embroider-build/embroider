import execa from 'execa';

async function githubMatrix() {
  let { stdout } = await execa(
    'pnpm',
    [
      '--filter',
      'embroider-test-scenarios',
      'exec',
      'scenario-tester',
      'list',
      '--require',
      'ts-node/register',
      '--files',
      '*-test.ts',
      '--matrix',
      'pnpm run test --filter "/^%s/"',
    ],
    {
      preferLocal: true,
    }
  );

  let { include: suites } = JSON.parse(stdout) as { include: { name: string; command: string }[]; name: string[] };

  let include = [
    ...suites.map(s => ({
      name: `${s.name} ubuntu`,
      os: 'ubuntu',
      command: s.command,
    })),
    ...suites
      .filter(s => !s.name.includes('watch-mode')) // TODO: watch tests are far too slow on windows right now
      .filter(s => !s.name.endsWith('compat-addon-classic-features-virtual-scripts')) // TODO: these tests are too slow on windows right now
      .filter(s => !s.name.endsWith('vite-dep-optimizer')) // these tests are absurdly slow on windows
      .filter(s => !s.name.endsWith('vite-internals')) // these tests are absurdly slow on windows
      .map(s => ({
        name: `${s.name} windows`,
        os: 'windows',
        command: s.command,
      })),
  ];

  return {
    name: include.map(s => s.name),
    include,
  };
}

async function main() {
  try {
    if (process.argv.includes('--matrix')) {
      const result = await githubMatrix();

      process.stdout.write(JSON.stringify(result));
    }
  } catch (error) {
    console.error(error);
    process.exitCode = -1;
  }
}

if (require.main === module) {
  main();
}
