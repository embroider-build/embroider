import type { ChildProcess } from 'child_process';
import { fork } from 'child_process';
import type Project from 'ember-cli/lib/models/project';
import type { Builder } from 'broccoli';

/*
  A minimalist test harness for running ember-cli builds and rebuilds on demand.

  The main benefit here is that you get a promise based API for both initial
  build and explicitly-required subsequent builds.
*/

export class Rebuilder {
  private pending:
    | undefined
    | {
        expecting: 'built';
        resolve: (message: BuiltMessage) => void;
        reject: (err: unknown) => void;
      }
    | {
        expecting: 'shutdown';
        resolve: () => void;
        reject: (err: unknown) => void;
      };

  private combinedBuffer: string[] = [];
  private child: ChildProcess;

  #outputPath: string | undefined;

  private constructor(projectPath: string, env?: Record<string, string>) {
    this.child = fork(__filename, [], {
      env: { ...process.env, ...env },
      cwd: projectPath,
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
    });
    this.child.stderr!.on('data', data => this.captureStream(data));
    this.child.stdout!.on('data', data => this.captureStream(data));

    this.child.on('close', exitCode => this.handleClose(exitCode));

    this.child.on('message', (m: BuiltMessage) => this.handleMessage(m));
  }

  async build(opts?: { changedDirs?: string[] }): Promise<void> {
    this.child.send(['rebuild', opts?.changedDirs ?? []]);
    await new Promise<BuiltMessage>((resolve, reject) => {
      this.pending = { resolve, reject, expecting: 'built' };
    });
  }

  async shutdown() {
    this.child.send(['shutdown']);
    await new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject, expecting: 'shutdown' };
    });
  }

  private captureStream(data: string) {
    this.combinedBuffer.push(data);
  }

  get outputPath(): string {
    return this.#outputPath!;
  }

  private handleClose(exitCode: number | null) {
    if (!this.pending) {
      throw new Error(`unexpected child exit. ${this.combinedBuffer.join('')}`);
    }
    let p = this.pending;
    this.pending = undefined;
    if (p.expecting === 'shutdown' && exitCode === 0) {
      p.resolve();
    } else {
      p.reject(new Error(this.combinedBuffer.join('')));
    }
  }

  private async ready(): Promise<void> {
    let { outputPath } = await new Promise<BuiltMessage>((resolve, reject) => {
      this.pending = { resolve, reject, expecting: 'built' };
    });
    this.#outputPath = outputPath;
  }

  private handleMessage(m: BuiltMessage) {
    if (!this.pending) {
      throw new Error(`unexpected message with nothing pending ${JSON.stringify(m)}\n${this.combinedBuffer.join('')}`);
    }
    let p = this.pending;
    this.pending = undefined;
    if (m.type === p.expecting) {
      p.resolve(m as any);
    } else {
      p.reject(new Error(`unexpected message ${JSON.stringify(m)}.\n${this.combinedBuffer.join('')}`));
    }
  }

  static async create(projectPath: string, env?: Record<string, string>): Promise<Rebuilder> {
    let instance = new this(projectPath, env);
    await instance.ready();
    return instance;
  }
}

interface BuiltMessage {
  type: 'built';
  outputPath: string;
}

function sendToParent(message: BuiltMessage) {
  process.send!(message);
}

async function main() {
  const { default: broccoli } = await import('broccoli');
  const { Builder } = broccoli;
  const { default: Project } = await import(
    require.resolve('ember-cli/lib/models/project', { paths: [process.cwd()] })
  );
  const { resolve } = await import('path');

  let project: Project = (Project as any).closestSync(process.cwd());
  let mod = require(resolve('./ember-cli-build'));
  let tree = mod({ project });
  let builder = new Builder(tree);

  await builder.build();
  sendToParent({ type: 'built', outputPath: builder.outputPath });

  process.on('message', async (m: ['rebuild', string[]] | ['shutdown']) => {
    try {
      if (m[0] === 'rebuild') {
        for (let changed of m[1]) {
          didChange(builder, changed);
        }
        await builder.build();
        sendToParent({ type: 'built', outputPath: builder.outputPath });
      }
      if (m[0] === 'shutdown') {
        await builder.cleanup();
        process.exit(0);
      }
    } catch (err) {
      process.stderr.write(err.stack);
      process.exit(-1);
    }
  });
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(err.stack);
    process.exit(-1);
  });
}

function didChange(builder: Builder, dir: string) {
  let node = builder.watchedSourceNodeWrappers.find(nw => nw.nodeInfo.sourceDirectory === dir);
  if (!node) {
    throw new Error(
      `test tried to simulated a watched file change in ${dir}, but we could not find the corresponding watched broccoli node`
    );
  }
  node.revise();
}
