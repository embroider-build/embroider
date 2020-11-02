import chalk from 'chalk';
import resolveModule from 'resolve';
import { AuditBuildOptions } from '../audit';
import { CaptureStream } from './capture';

export async function buildApp(options: AuditBuildOptions): Promise<void> {
  let { default: cli } = await import(resolveModule.sync('ember-cli', { basedir: options.app }));
  process.env.STAGE2_ONLY = 'true';
  let capture = new CaptureStream();
  let orig = { cwd: process.cwd(), log: console.log, error: console.error, warn: console.warn };
  process.chdir(options.app);
  // this is icky, but too many things in the build don't respect the
  // `outputStream`, etc, options we pass below.
  console.log = console.warn = console.error = capture.log;
  try {
    let result = await cli({
      cliArgs: ['build'],
      outputStream: capture,
      errorStream: capture,
    });
    let exitCode = typeof result === 'object' ? result.exitCode : result;
    // an undefined exit code means success, because of course it does.
    if (exitCode != null && exitCode !== 0) {
      throw new BuildError(
        `${chalk.yellow('Unable to begin audit')} because the build failed. Build output follows:\n${capture.output}`
      );
    }
  } finally {
    process.chdir(orig.cwd);
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

export class BuildError extends Error {
  isBuildError = true;
  constructor(buildOutput: string) {
    super(buildOutput);
  }
}

export function isBuildError(err: any): err is BuildError {
  return err?.isBuildError;
}
