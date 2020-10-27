import { readFileSync, readJSONSync } from 'fs-extra';
import { join } from 'path';
import { AppMeta } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import execa from 'execa';
import chalk from 'chalk';

export interface AuditOptions {
  debug: boolean;
  'reuse-build': boolean;
  app: string;
}

export class AuditResults {
  findings: {
    package: string;
    message: string;
    filename: string;
    lineNumber: number;
  }[] = [];

  humanReadable(): string {
    return `${chalk.red('TODO')} print human readable results here\n`;
  }
}

export class Audit {
  static async run(options: AuditOptions): Promise<AuditResults> {
    let dir = await this.buildApp(options);
    return new this(dir, options).run();
  }

  private static async buildApp(options: AuditOptions): Promise<string> {
    if (!options['reuse-build']) {
      try {
        await execa('ember', ['build'], {
          all: true,
          cwd: options.app,
          env: {
            STAGE2_ONLY: 'true',
          },
        });
      } catch (err) {
        throw new BuildError(err.all);
      }
    }
    return readFileSync(join(options.app, 'dist/.stage2-output'), 'utf8');
  }

  constructor(private appDir: string, private options: AuditOptions) {}

  @Memoize()
  get pkg() {
    return readJSONSync(join(this.appDir, 'package.json'));
  }

  get meta() {
    return this.pkg['ember-addon'] as AppMeta;
  }

  async run(): Promise<AuditResults> {
    if (this.options.debug) {
      console.log(`running with meta`, this.meta);
    }
    return new AuditResults();
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
