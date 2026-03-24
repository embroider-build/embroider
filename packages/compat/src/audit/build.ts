import chalk from 'chalk';
import type { AuditBuildOptions } from '../audit';
import { spawn } from 'child_process';

export async function buildApp(options: AuditBuildOptions): Promise<void> {
  let result = await execute(`node node_modules/ember-cli/bin/ember build`, {
    pwd: options.app,
    env: {
      STAGE2_ONLY: 'true',
    },
  });

  if (result.exitCode !== 0) {
    throw new BuildError(
      `${chalk.yellow('Unable to begin audit')} because the build failed. Build output follows:\n${result.output}`
    );
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

async function execute(
  shellCommand: string,
  opts?: { env?: Record<string, string>; pwd?: string }
): Promise<{
  exitCode: number;
  stderr: string;
  stdout: string;
  output: string;
}> {
  let env: Record<string, string | undefined> | undefined;
  if (opts?.env) {
    env = { ...process.env, ...opts.env };
  }
  let child = spawn(shellCommand, {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: opts?.pwd,
    shell: true,
    env,
  });
  let stderrBuffer: string[] = [];
  let stdoutBuffer: string[] = [];
  let combinedBuffer: string[] = [];
  child.stderr.on('data', data => {
    stderrBuffer.push(data);
    combinedBuffer.push(data);
  });
  child.stdout.on('data', data => {
    stdoutBuffer.push(data);
    combinedBuffer.push(data);
  });
  return new Promise(resolve => {
    child.on('close', (exitCode: number) => {
      resolve({
        exitCode,
        get stdout() {
          return stdoutBuffer.join('');
        },
        get stderr() {
          return stderrBuffer.join('');
        },
        get output() {
          return combinedBuffer.join('');
        },
      });
    });
  });
}
